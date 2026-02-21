import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { 
  getEventByName, 
  getParticipant, 
  createParticipant, 
  updateParticipant,
  markCertificateSent 
} from './lib/supabase.js';
import { getTemplateFile } from './tools/google-drive.tool.js';
import { generateCertificate } from './tools/pdf-generator.tool.js';
import { sendCertificate } from './tools/agentmail.tool.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
});
app.use('/webhook', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip
  }));
  next();
});

// ============================================
// ROUTES
// ============================================

/**
 * Health check endpoint (for cron job keep-alive)
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Main webhook endpoint for form submissions
 */
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { name, email, event, rating, feedback, enjoyed_most, suggestions } = req.body;

    // Validate required fields
    if (!name || !email || !event) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, event' 
      });
    }

    console.log(`[Workflow] Starting for ${email} - ${event}`);

    // Step 1: Get event configuration from database
    const eventData = await getEventByName(event);
    console.log(`[Workflow] Found event: ${eventData.event_name}`);

    // Step 2: Check if participant exists
    const existingParticipant = await getParticipant(email, eventData.id);

    let participantId;

    if (existingParticipant) {
      console.log(`[Workflow] Participant exists: ${email}`);

      // If certificate already sent, don't resend
      if (existingParticipant.certificate_sent) {
        console.log(`[Workflow] Certificate already sent to ${email}`);
        return res.json({
          status: 'already_sent',
          message: 'Certificate was already sent to this email',
          participant_id: existingParticipant.id
        });
      }

      // Update participant with feedback data
      const updated = await updateParticipant(existingParticipant.id, {
        feedback_submitted: true,
        feedback_submitted_at: new Date().toISOString(),
        rating,
        feedback_text: feedback,
        enjoyed_most,
        suggestions
      });

      participantId = updated.id;
    } else {
      // Create new participant
      console.log(`[Workflow] Creating new participant: ${email}`);

      const newParticipant = await createParticipant({
        name,
        email,
        event_id: eventData.id,
        feedback_submitted: true,
        feedback_submitted_at: new Date().toISOString(),
        certificate_sent: false,
        rating,
        feedback_text: feedback,
        enjoyed_most,
        suggestions
      });

      participantId = newParticipant.id;
    }

    // Step 3: Download template from Google Drive
    console.log(`[Workflow] Fetching template: ${eventData.cert_template_name}`);
    const templateBuffer = await getTemplateFile(eventData.cert_template_name);

    // Step 4: Generate certificate
    console.log(`[Workflow] Generating certificate for ${name}`);
    const certificatePDF = await generateCertificate(templateBuffer, name, {
      name_x: eventData.name_x,
      name_y: eventData.name_y,
      font_size: eventData.font_size,
      font_style: eventData.font_style
    });

    // Step 5: Send via AgentMail
    console.log(`[Workflow] Sending certificate to ${email}`);
    await sendCertificate(email, name, certificatePDF, eventData.event_name);

    // Step 6: Mark as sent in database
    await markCertificateSent(participantId);

    const duration = Date.now() - startTime;
    console.log(`[Workflow] ✅ Complete in ${duration}ms`);

    res.json({
      status: 'success',
      message: 'Certificate generated and sent',
      participant_id: participantId,
      duration_ms: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Workflow] ❌ Error:', error.message);

    res.status(500).json({
      error: 'Failed to process request',
      message: error.message,
      duration_ms: duration
    });
  }
});

/**
 * AgentMail webhook endpoint (for reply handling - Phase 2)
 */
app.post('/agentmail-webhook', async (req, res) => {
  try {
    console.log('[AgentMail Webhook] Received:', JSON.stringify(req.body));

    // TODO: Implement reply intelligence in Phase 2
    // For now, just log and acknowledge
    res.json({ status: 'received' });
  } catch (error) {
    console.error('[AgentMail Webhook] Error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Test database connection
 */
app.get('/test-db', async (req, res) => {
  try {
    // Try to fetch any event
    const { default: getSupabaseClient } = await import('./lib/supabase.js');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('events').select('*').limit(1);

    if (error) throw error;

    res.json({ 
      status: 'connected', 
      events_found: data?.length || 0,
      sample: data?.[0] || null
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(JSON.stringify({ 
    level: 'ERROR', 
    error: err.message, 
    stack: err.stack 
  }));
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   CertBot Server Running                 ║
║   Port: ${PORT}                             ║
║   Environment: ${process.env.NODE_ENV || 'development'}         ║
╚══════════════════════════════════════════╝
  `);
});
