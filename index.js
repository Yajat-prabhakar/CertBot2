import crypto from 'node:crypto';

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import {
  getEventByName,
  getParticipant,
  updateParticipant,
  markCertificateSent,
} from './lib/supabase.js';
import { AppError, ConfigError, ExternalError, UserError, isAppError } from './lib/errors.js';
import { logError, logInfo, serializeError } from './lib/logger.js';
import { isTimeoutError } from './lib/retry.js';
import { getTemplateFile } from './tools/google-drive.tool.js';
import { generateCertificate } from './tools/pdf-generator.tool.js';
import { sendCertificate } from './tools/agentmail.tool.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FEEDBACK_FIELD_LIMIT = 500;
const OPTIONAL_FEEDBACK_FIELD_LIMIT = 300;

function stripHtmlTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

function sanitizePlainText(value) {
  return String(value || '').trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createRequestId() {
  return crypto.randomUUID();
}

function normalizeWorkflowError(error) {
  if (isAppError(error)) {
    return error;
  }

  if (isTimeoutError(error)) {
    return new ExternalError('Request timed out while waiting on an upstream service', {
      statusCode: 504,
      code: 'UPSTREAM_TIMEOUT',
      cause: error,
    });
  }

  return new AppError('Unexpected server error', {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    cause: error,
  });
}

async function runPhase(req, phase, handler, details = {}) {
  const startedAt = Date.now();
  logInfo('Webhook', 'PhaseStarted', {
    phase,
    ...details,
  }, req.requestId);

  try {
    const result = await handler();
    logInfo('Webhook', 'PhaseCompleted', {
      phase,
      durationMs: Date.now() - startedAt,
      ...details,
    }, req.requestId);
    return result;
  } catch (error) {
    logError('Webhook', 'PhaseFailed', {
      phase,
      durationMs: Date.now() - startedAt,
      ...details,
      error: serializeError(error),
    }, req.requestId);
    throw error;
  }
}

function buildErrorResponse(error, requestId) {
  const safeMessage = error instanceof AppError && error.code !== 'INTERNAL_SERVER_ERROR'
    ? error.message
    : 'Failed to process request';

  return {
    error: error.code || 'INTERNAL_SERVER_ERROR',
    message: safeMessage,
    requestId,
  };
}

function validateWebhookRequest(req, res, next) {
  try {
    const name = sanitizePlainText(req.body?.name);
    const email = sanitizePlainText(req.body?.email).toLowerCase();
    const event = sanitizePlainText(req.body?.event);
    const feedback = stripHtmlTags(req.body?.feedback);
    const enjoyedMost = stripHtmlTags(req.body?.enjoyed_most);
    const suggestions = stripHtmlTags(req.body?.suggestions);
    const ratingValue = typeof req.body?.rating === 'string'
      ? Number(req.body.rating)
      : req.body?.rating;

    if (!name || !email || !event) {
      throw new UserError('Missing required fields: name, email, event', {
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    if (!validateEmail(email)) {
      throw new UserError('Please provide a valid email address', {
        code: 'INVALID_EMAIL',
      });
    }

    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      throw new UserError('Rating must be an integer between 1 and 5', {
        code: 'INVALID_RATING',
      });
    }

    if (!feedback || feedback.length < 10 || feedback.length > FEEDBACK_FIELD_LIMIT) {
      throw new UserError(`Feedback must be between 10 and ${FEEDBACK_FIELD_LIMIT} characters`, {
        code: 'INVALID_FEEDBACK',
      });
    }

    if (enjoyedMost.length > OPTIONAL_FEEDBACK_FIELD_LIMIT) {
      throw new UserError(`What you enjoyed most must be less than ${OPTIONAL_FEEDBACK_FIELD_LIMIT} characters`, {
        code: 'INVALID_ENJOYED_MOST',
      });
    }

    if (suggestions.length > OPTIONAL_FEEDBACK_FIELD_LIMIT) {
      throw new UserError(`Suggestions must be less than ${OPTIONAL_FEEDBACK_FIELD_LIMIT} characters`, {
        code: 'INVALID_SUGGESTIONS',
      });
    }

    req.validatedBody = {
      name,
      email,
      event,
      rating: ratingValue,
      feedback,
      enjoyed_most: enjoyedMost,
      suggestions,
    };

    logInfo('Webhook', 'RequestValidated', {
      event,
      email,
      sanitizedFeedbackLength: feedback.length,
      sanitizedEnjoyedMostLength: enjoyedMost.length,
      sanitizedSuggestionsLength: suggestions.length,
    }, req.requestId);

    next();
  } catch (error) {
    next(normalizeWorkflowError(error));
  }
}

async function resolveParticipant(req, eventData) {
  const participant = await runPhase(req, 'lookup-participant', () => getParticipant(
    req.validatedBody.email,
    eventData.id,
    { requestId: req.requestId }
  ), {
    eventId: eventData.id,
    email: req.validatedBody.email,
  });

  if (!participant) {
    throw new UserError('You were not registered for this event. Feedback submission is restricted to attendees only.', {
      statusCode: 403,
      code: 'REGISTRATION_REQUIRED',
      details: {
        email: req.validatedBody.email,
        eventId: eventData.id,
      },
    });
  }

  if (participant.certificate_sent) {
    logInfo('Webhook', 'CertificateAlreadySent', {
      participantId: participant.id,
      email: req.validatedBody.email,
    }, req.requestId);

    return {
      alreadySent: true,
      participantId: participant.id,
    };
  }

  const updatedParticipant = await runPhase(req, 'update-feedback', () => updateParticipant(
    participant.id,
    {
      feedback_submitted: true,
      feedback_submitted_at: new Date().toISOString(),
      rating: req.validatedBody.rating,
      feedback_text: req.validatedBody.feedback,
      enjoyed_most: req.validatedBody.enjoyed_most,
      suggestions: req.validatedBody.suggestions,
    },
    { requestId: req.requestId }
  ), {
    participantId: participant.id,
  });

  return {
    alreadySent: false,
    participantId: updatedParticipant.id,
  };
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = createRequestId();
  req.requestStartedAt = Date.now();
  req.requestCache = {
    driveFileIds: new Map(),
  };
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use('/webhook', limiter);

app.use((req, res, next) => {
  logInfo('HTTP', 'RequestReceived', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  }, req.requestId);

  res.on('finish', () => {
    logInfo('HTTP', 'RequestCompleted', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - req.requestStartedAt,
    }, req.requestId);
  });

  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.requestId,
  });
});

app.post('/webhook', validateWebhookRequest, async (req, res, next) => {
  const workflowStartedAt = Date.now();

  try {
    logInfo('Webhook', 'WorkflowStarted', {
      event: req.validatedBody.event,
      email: req.validatedBody.email,
    }, req.requestId);

    const eventData = await runPhase(req, 'load-event-config', () => getEventByName(
      req.validatedBody.event,
      { requestId: req.requestId }
    ), {
      eventName: req.validatedBody.event,
    });

    const participantResult = await resolveParticipant(req, eventData);

    if (participantResult.alreadySent) {
      return res.json({
        status: 'already_sent',
        message: 'Certificate was already sent to this email',
        participant_id: participantResult.participantId,
        requestId: req.requestId,
      });
    }

    const templateBuffer = await runPhase(req, 'fetch-template', () => getTemplateFile(
      eventData.cert_template_name,
      {
        requestId: req.requestId,
        cache: req.requestCache.driveFileIds,
      }
    ), {
      templateName: eventData.cert_template_name,
    });

    const certificatePDF = await runPhase(req, 'generate-certificate', () => generateCertificate(
      templateBuffer,
      req.validatedBody.name,
      {
        name_x: eventData.name_x,
        name_y: eventData.name_y,
        font_size: eventData.font_size,
        font_style: eventData.font_style,
        text_alignment: eventData.text_alignment,
        text_y_position: eventData.text_y_position,
        text_color: eventData.text_color || eventData.font_color,
        date_color: eventData.date_color,
      },
      { requestId: req.requestId }
    ), {
      participantId: participantResult.participantId,
      participantName: req.validatedBody.name,
    });

    await runPhase(req, 'send-certificate-email', () => sendCertificate(
      req.validatedBody.email,
      req.validatedBody.name,
      certificatePDF,
      eventData.event_name,
      { requestId: req.requestId }
    ), {
      participantId: participantResult.participantId,
      email: req.validatedBody.email,
    });

    await runPhase(req, 'mark-certificate-sent', () => markCertificateSent(
      participantResult.participantId,
      { requestId: req.requestId }
    ), {
      participantId: participantResult.participantId,
    });

    const duration = Date.now() - workflowStartedAt;
    logInfo('Webhook', 'WorkflowCompleted', {
      participantId: participantResult.participantId,
      durationMs: duration,
    }, req.requestId);

    res.json({
      status: 'success',
      message: 'Certificate generated and sent',
      participant_id: participantResult.participantId,
      duration_ms: duration,
      requestId: req.requestId,
    });
  } catch (error) {
    next(normalizeWorkflowError(error));
  }
});

app.post('/agentmail-webhook', async (req, res, next) => {
  try {
    logInfo('AgentMailWebhook', 'WebhookReceived', {
      bodyKeys: Object.keys(req.body || {}),
    }, req.requestId);

    res.json({ status: 'received', requestId: req.requestId });
  } catch (error) {
    next(normalizeWorkflowError(error));
  }
});

app.get('/test-db', async (req, res, next) => {
  try {
    const { default: getSupabaseClient } = await import('./lib/supabase.js');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('events').select('*').limit(1);

    if (error) {
      throw new ConfigError('Supabase test query failed', {
        code: 'SUPABASE_TEST_FAILED',
        cause: error,
      });
    }

    res.json({
      status: 'connected',
      events_found: data?.length || 0,
      sample: data?.[0] || null,
      requestId: req.requestId,
    });
  } catch (error) {
    next(normalizeWorkflowError(error));
  }
});

app.use((err, req, res, next) => {
  const error = normalizeWorkflowError(err);
  logError('HTTP', 'RequestFailed', {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    error: serializeError(error),
  }, req.requestId);

  res.status(error.statusCode || 500).json(buildErrorResponse(error, req.requestId));
});

app.listen(PORT, () => {
  logInfo('Server', 'Started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
  });
});
