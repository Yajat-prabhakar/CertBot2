import dotenv from 'dotenv';
import { AgentMailClient } from 'agentmail';

import { ConfigError, ExternalError } from '../lib/errors.js';
import { logInfo, logWarn, serializeError } from '../lib/logger.js';
import { getErrorStatus, isNetworkError, isTimeoutError, withExponentialBackoff } from '../lib/retry.js';

dotenv.config();

let agentmailClient;

function getInboxId() {
  const inboxId = process.env.AGENTMAIL_INBOX_ID || process.env.AGENTMAIL_INBOX;
  if (!inboxId) {
    throw new ConfigError('Missing AgentMail inbox id. Set AGENTMAIL_INBOX_ID (or AGENTMAIL_INBOX) in .env', {
      code: 'AGENTMAIL_INBOX_MISSING',
    });
  }
  return inboxId;
}

function getAgentmailBaseUrl() {
  const raw = (process.env.AGENTMAIL_BASE_URL || 'https://api.agentmail.to/').trim();
  const unquoted = raw.replace(/^['"]|['"]$/g, '');

  try {
    const parsed = new URL(unquoted);
    return parsed.toString();
  } catch {
    throw new ConfigError(
      `Invalid AGENTMAIL_BASE_URL: "${raw}". Use a full URL like https://api.agentmail.to/`,
      {
        code: 'AGENTMAIL_BASE_URL_INVALID',
      }
    );
  }
}

function getClient() {
  if (agentmailClient) {
    return agentmailClient;
  }

  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    throw new ConfigError('Missing AGENTMAIL_API_KEY in .env', {
      code: 'AGENTMAIL_API_KEY_MISSING',
    });
  }

  agentmailClient = new AgentMailClient({
    baseUrl: getAgentmailBaseUrl(),
    apiKey,
  });

  return agentmailClient;
}

function isTransientAgentMailError(error) {
  const status = Number(getErrorStatus(error));
  return isNetworkError(error) || isTimeoutError(error) || status >= 500;
}

function toAgentMailError(action, error) {
  const status = Number(getErrorStatus(error));

  if (isTransientAgentMailError(error)) {
    return new ExternalError(`AgentMail ${action} failed`, {
      statusCode: isTimeoutError(error) ? 504 : 502,
      code: 'AGENTMAIL_UNAVAILABLE',
      cause: error,
    });
  }

  if ([401, 403].includes(status)) {
    return new ConfigError(`AgentMail ${action} failed: authentication was rejected`, {
      code: 'AGENTMAIL_AUTH_FAILED',
      cause: error,
    });
  }

  return new ExternalError(`AgentMail ${action} failed`, {
    statusCode: 502,
    code: 'AGENTMAIL_REQUEST_FAILED',
    cause: error,
  });
}

async function sendMessage(payload, { requestId, recipientEmail, action }) {
  const client = getClient();
  const inboxId = getInboxId();

  try {
    return await withExponentialBackoff(
      () => client.inboxes.messages.send(inboxId, payload),
      {
        attempts: 3,
        baseDelayMs: 500,
        shouldRetry: isTransientAgentMailError,
        onRetry: async ({ attempt, delayMs, error }) => {
          logWarn('AgentMail', 'RetryingSend', {
            action,
            recipientEmail,
            attempt,
            delayMs,
            error: serializeError(error),
          }, requestId);
        },
      }
    );
  } catch (error) {
    throw toAgentMailError(action, error);
  }
}

export async function sendCertificate(recipientEmail, recipientName, pdfBuffer, eventName, options = {}) {
  const { requestId } = options;

  logInfo('AgentMail', 'PreparingCertificateEmail', {
    recipientEmail,
    eventName,
  }, requestId);

  const pdfBase64 = pdfBuffer.toString('base64');

  const payload = {
    to: recipientEmail,
    subject: `Your ${eventName} Certificate`,
    text: `Hi ${recipientName}, thank you for participating in ${eventName}! Your certificate is attached. Best regards, CertBot`,
    html: `<p>Hi ${recipientName}, thank you for participating in <strong>${eventName}</strong>! Your certificate is attached. We hope you enjoyed the event. Best regards, CertBot</p>`,
    attachments: [
      {
        filename: `${eventName.replace(/\s+/g, '_')}_Certificate.pdf`,
        content: pdfBase64,
        content_type: 'application/pdf',
      },
    ],
  };

  const result = await sendMessage(payload, {
    requestId,
    recipientEmail,
    action: 'send certificate',
  });

  logInfo('AgentMail', 'CertificateSent', {
    recipientEmail,
    eventName,
  }, requestId);

  return result;
}

export async function sendReply(recipientEmail, message, options = {}) {
  const { requestId } = options;
  const payload = {
    to: recipientEmail,
    subject: 'Re: Your Certificate',
    text: `${message}\n\nBest regards,\nCertBot`,
    html: `<p>${message}</p><p>Best regards,<br>CertBot</p>`,
  };

  const result = await sendMessage(payload, {
    requestId,
    recipientEmail,
    action: 'send reply',
  });

  logInfo('AgentMail', 'ReplySent', {
    recipientEmail,
  }, requestId);

  return result;
}
