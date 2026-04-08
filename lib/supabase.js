import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { ConfigError, ExternalError, UserError, isAppError } from './errors.js';
import { logInfo, logWarn, serializeError } from './logger.js';
import { getErrorStatus, isNetworkError, isTimeoutError, withExponentialBackoff } from './retry.js';

dotenv.config();

let supabase;

const EVENT_CACHE_TTL_MS = 5 * 60 * 1000;
const eventCache = new Map();

function getCacheKey(eventName) {
  return String(eventName).trim().toLowerCase();
}

function getCachedEvent(eventName) {
  const cacheKey = getCacheKey(eventName);
  const cachedEntry = eventCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    eventCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.value;
}

function setCachedEvent(eventName, value) {
  eventCache.set(getCacheKey(eventName), {
    value,
    expiresAt: Date.now() + EVENT_CACHE_TTL_MS,
  });
}

function isTransientSupabaseError(error) {
  if (error instanceof ConfigError || error instanceof UserError) {
    return false;
  }

  if (error instanceof ExternalError) {
    return true;
  }

  const status = getErrorStatus(error);
  return (
    isNetworkError(error) ||
    isTimeoutError(error) ||
    [408, 500, 502, 503, 504].includes(Number(status))
  );
}

function toSupabaseError(action, error, details) {
  if (isAppError(error)) {
    return error;
  }

  if (isTransientSupabaseError(error)) {
    return new ExternalError(`Supabase ${action} failed`, {
      statusCode: isTimeoutError(error) ? 504 : 502,
      code: 'SUPABASE_UNAVAILABLE',
      details,
      cause: error,
    });
  }

  return new ConfigError(`Supabase ${action} failed`, {
    code: 'SUPABASE_QUERY_FAILED',
    details,
    cause: error,
  });
}

async function runSupabaseQuery(queryFactory, { action, requestId, details = {}, attempts = 2 }) {
  try {
    return await withExponentialBackoff(
      async () => {
        const { data, error } = await queryFactory();
        if (error) {
          throw error;
        }
        return data;
      },
      {
        attempts,
        baseDelayMs: 250,
        shouldRetry: isTransientSupabaseError,
        onRetry: async ({ attempt, delayMs, error }) => {
          logWarn('Supabase', 'RetryingQuery', {
            action,
            attempt,
            delayMs,
            details,
            error: serializeError(error),
          }, requestId);
        },
      }
    );
  } catch (error) {
    throw toSupabaseError(action, error, details);
  }
}

function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new ConfigError(
      'Missing Supabase configuration: set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env',
      {
        code: 'SUPABASE_CONFIG_MISSING',
      }
    );
  }

  supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
}

export async function getEventByName(eventName, options = {}) {
  const { requestId } = options;
  const normalizedEventName = String(eventName).trim();
  const cachedEvent = getCachedEvent(normalizedEventName);

  if (cachedEvent) {
    logInfo('Supabase', 'EventCacheHit', {
      eventName: normalizedEventName,
    }, requestId);
    return cachedEvent;
  }

  const data = await runSupabaseQuery(
    () => getSupabaseClient()
      .from('events')
      .select('*')
      .eq('event_name', normalizedEventName)
      .maybeSingle(),
    {
      action: 'fetch event',
      requestId,
      details: {
        eventName: normalizedEventName,
      },
    }
  );

  if (!data) {
    throw new UserError(`Event not found: ${normalizedEventName}`, {
      code: 'EVENT_NOT_FOUND',
      details: {
        eventName: normalizedEventName,
      },
    });
  }

  setCachedEvent(normalizedEventName, data);
  logInfo('Supabase', 'EventFetched', {
    eventName: normalizedEventName,
    eventId: data.id,
    cacheTtlMs: EVENT_CACHE_TTL_MS,
  }, requestId);

  return data;
}

export async function getParticipant(email, eventId, options = {}) {
  const { requestId } = options;

  const data = await runSupabaseQuery(
    () => getSupabaseClient()
      .from('participants')
      .select('*')
      .eq('email', email)
      .eq('event_id', eventId)
      .maybeSingle(),
    {
      action: 'fetch participant',
      requestId,
      details: {
        email,
        eventId,
      },
    }
  );

  return data;
}

export async function createParticipant(participantData, options = {}) {
  const { requestId } = options;

  return runSupabaseQuery(
    () => getSupabaseClient()
      .from('participants')
      .insert(participantData)
      .select()
      .single(),
    {
      action: 'create participant',
      requestId,
      details: {
        email: participantData.email,
        eventId: participantData.event_id,
      },
    }
  );
}

export async function updateParticipant(participantId, updates, options = {}) {
  const { requestId } = options;

  return runSupabaseQuery(
    () => getSupabaseClient()
      .from('participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single(),
    {
      action: 'update participant',
      requestId,
      details: {
        participantId,
        fields: Object.keys(updates),
      },
    }
  );
}

export async function markCertificateSent(participantId, options = {}) {
  const { requestId } = options;

  return runSupabaseQuery(
    () => getSupabaseClient()
      .from('participants')
      .update({
        certificate_sent: true,
        certificate_sent_at: new Date().toISOString(),
      })
      .eq('id', participantId)
      .select()
      .single(),
    {
      action: 'mark certificate sent',
      requestId,
      details: {
        participantId,
      },
    }
  );
}

export default getSupabaseClient;
