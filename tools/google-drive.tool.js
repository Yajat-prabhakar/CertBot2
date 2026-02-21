import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Get PDF template from Google Drive
 * @param {string} filename - Name of the PDF file
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
export async function getTemplateFile(filename) {
  try {
    // Parse service account JSON from environment variable
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    // Authenticate
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Search for file in the specified folder
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;

    console.log(`[GoogleDrive] Searching for file: ${filename}`);

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (!res.data.files || res.data.files.length === 0) {
      throw new Error(`Template file not found: ${filename}`);
    }

    const fileId = res.data.files[0].id;
    console.log(`[GoogleDrive] Found file with ID: ${fileId}`);

    // Download file
    const file = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    console.log(`[GoogleDrive] Downloaded ${filename} (${file.data.byteLength} bytes)`);

    return Buffer.from(file.data);
  } catch (error) {
    console.error('[GoogleDrive] Error:', error.message);
    throw error;
  }
}
