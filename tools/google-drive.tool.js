import { google } from 'googleapis';
import dotenv from 'dotenv';

import { ConfigError, ExternalError } from '../lib/errors.js';
import { logInfo, logWarn, serializeError } from '../lib/logger.js';
import { getErrorStatus, isNetworkError, isTimeoutError, withExponentialBackoff } from '../lib/retry.js';

dotenv.config();

let driveClient;

function getDriveFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

  if (!folderId) {
    throw new ConfigError('Missing GOOGLE_DRIVE_FOLDER_ID in .env', {
      code: 'GOOGLE_DRIVE_FOLDER_MISSING',
    });
  }

  return folderId;
}

function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const rawServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawServiceAccount) {
    throw new ConfigError('Missing GOOGLE_SERVICE_ACCOUNT_JSON in .env', {
      code: 'GOOGLE_SERVICE_ACCOUNT_MISSING',
    });
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch (error) {
    throw new ConfigError('Invalid GOOGLE_SERVICE_ACCOUNT_JSON: expected valid JSON credentials', {
      code: 'GOOGLE_SERVICE_ACCOUNT_INVALID',
      cause: error,
    });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/'/g, "\\'");
}

function isTransientDriveError(error) {
  const status = Number(getErrorStatus(error));
  return isNetworkError(error) || isTimeoutError(error) || status >= 500;
}

function toDriveError(action, filename, error) {
  if (isTransientDriveError(error)) {
    return new ExternalError(`Google Drive ${action} failed`, {
      statusCode: isTimeoutError(error) ? 504 : 502,
      code: 'GOOGLE_DRIVE_UNAVAILABLE',
      details: { filename },
      cause: error,
    });
  }

  return new ConfigError(`Google Drive ${action} failed`, {
    code: 'GOOGLE_DRIVE_REQUEST_FAILED',
    details: { filename },
    cause: error,
  });
}

async function withDriveRetry(operation, { action, filename, requestId }) {
  try {
    return await withExponentialBackoff(operation, {
      attempts: 3,
      baseDelayMs: 400,
      shouldRetry: isTransientDriveError,
      onRetry: async ({ attempt, delayMs, error }) => {
        logWarn('GoogleDrive', 'RetryingRequest', {
          action,
          filename,
          attempt,
          delayMs,
          error: serializeError(error),
        }, requestId);
      },
    });
  } catch (error) {
    throw toDriveError(action, filename, error);
  }
}

async function getFileId(filename, { requestId, cache }) {
  if (cache?.has(filename)) {
    const cachedFileId = cache.get(filename);
    logInfo('GoogleDrive', 'TemplateCacheHit', {
      filename,
      fileId: cachedFileId,
    }, requestId);
    return cachedFileId;
  }

  const folderId = getDriveFolderId();
  const query = `name='${escapeDriveQueryValue(filename)}' and '${folderId}' in parents and trashed=false`;
  const drive = getDriveClient();

  logInfo('GoogleDrive', 'SearchingTemplate', {
    filename,
    folderId,
  }, requestId);

  const response = await withDriveRetry(
    () => drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    }),
    {
      action: 'search',
      filename,
      requestId,
    }
  );

  const files = response.data.files ?? [];

  if (files.length === 0) {
    throw new ConfigError(`Template file not found: ${filename}`, {
      code: 'TEMPLATE_NOT_FOUND',
      details: { filename, folderId },
    });
  }

  if (files.length > 1) {
    logWarn('GoogleDrive', 'MultipleTemplatesFound', {
      filename,
      fileIds: files.map((file) => file.id),
      matchCount: files.length,
    }, requestId);
  }

  const fileId = files[0].id;
  cache?.set(filename, fileId);

  logInfo('GoogleDrive', 'TemplateResolved', {
    filename,
    fileId,
  }, requestId);

  return fileId;
}

export async function getTemplateFile(filename, options = {}) {
  const { requestId, cache } = options;
  const drive = getDriveClient();
  const fileId = await getFileId(filename, { requestId, cache });

  const file = await withDriveRetry(
    () => drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    ),
    {
      action: 'download',
      filename,
      requestId,
    }
  );

  logInfo('GoogleDrive', 'TemplateDownloaded', {
    filename,
    fileId,
    bytes: file.data.byteLength,
  }, requestId);

  return Buffer.from(file.data);
}
