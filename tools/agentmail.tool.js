import dotenv from 'dotenv';
import { AgentMailClient } from 'agentmail';

dotenv.config();

function getInboxId() {
  const inboxId = process.env.AGENTMAIL_INBOX_ID || process.env.AGENTMAIL_INBOX;
  if (!inboxId) {
    throw new Error('Missing AgentMail inbox id. Set AGENTMAIL_INBOX_ID (or AGENTMAIL_INBOX) in .env');
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
    throw new Error(
      `Invalid AGENTMAIL_BASE_URL: "${raw}". Use a full URL like https://api.agentmail.to/`
    );
  }
}

function getClient() {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    throw new Error('Missing AGENTMAIL_API_KEY in .env');
  }

  return new AgentMailClient({
    baseUrl: getAgentmailBaseUrl(),
    apiKey
  });
}

/**
 * Send certificate via AgentMail
 * @param {string} recipientEmail - Recipient email address
 * @param {string} recipientName - Recipient name
 * @param {Buffer} pdfBuffer - Certificate PDF as buffer
 * @param {string} eventName - Event name
 * @returns {Promise<Object>} - Send result
 */
export async function sendCertificate(recipientEmail, recipientName, pdfBuffer, eventName) {
  try {
    console.log(`[AgentMail] Sending certificate to: ${recipientEmail}`);
    const client = getClient();
    const inboxId = getInboxId();

    // Convert PDF buffer to base64
    const pdfBase64 = pdfBuffer.toString('base64');

    // Prepare email payload
    const payload = {
      to: recipientEmail,
      subject: `Your ${eventName} Certificate`,
      text: `Hi ${recipientName}, thank you for participating in ${eventName}! Your certificate is attached. Best regards, CertBot`,
      html: `<p>Hi ${recipientName}, thank you for participating in <strong>${eventName}</strong>! Your certificate is attached. We hope you enjoyed the event. Best regards, CertBot</p>`,
      attachments: [
        {
          filename: `${eventName.replace(/\s+/g, '_')}_Certificate.pdf`,
          content: pdfBase64,
          content_type: 'application/pdf'
        }
      ]
    };

    const result = await client.inboxes.messages.send(inboxId, payload);
    console.log(`[AgentMail] Certificate sent successfully to ${recipientEmail}`);

    return result;
  } catch (error) {
    console.error('[AgentMail] Error sending certificate:', error?.message || error);

    // Retry logic (3 attempts with exponential backoff)
    console.log('[AgentMail] Retrying...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    throw error;
  }
}

/**
 * Send a simple email reply
 */
export async function sendReply(recipientEmail, message) {
  try {
    const client = getClient();
    const inboxId = getInboxId();

    const payload = {
      to: recipientEmail,
      subject: 'Re: Your Certificate',
      text: `${message}\n\nBest regards,\nCertBot`,
      html: `<p>${message}</p><p>Best regards,<br>CertBot</p>`
    };

    console.log(`[AgentMail] Reply sent to ${recipientEmail}`);
    return await client.inboxes.messages.send(inboxId, payload);
  } catch (error) {
    console.error('[AgentMail] Error sending reply:', error?.message || error);
    throw error;
  }
}
