import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabase;

function getSupabaseClient() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase configuration: set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env'
    );
  }

  supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabase;
}

/**
 * Get event configuration by name
 */
export async function getEventByName(eventName) {
  const { data, error } = await getSupabaseClient()
    .from('events')
    .select('*')
    .eq('event_name', eventName)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching event:', error);
    throw new Error(`Event not found: ${eventName}`);
  }

  return data;
}

/**
 * Get participant by email and event
 */
export async function getParticipant(email, eventId) {
  const { data, error } = await getSupabaseClient()
    .from('participants')
    .select('*')
    .eq('email', email)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching participant:', error);
    return null;
  }

  return data;
}

/**
 * Create new participant
 */
export async function createParticipant(participantData) {
  const { data, error } = await getSupabaseClient()
    .from('participants')
    .insert(participantData)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating participant:', error);
    throw new Error('Failed to create participant');
  }

  return data;
}

/**
 * Update participant feedback and data
 */
export async function updateParticipant(participantId, updates) {
  const { data, error } = await getSupabaseClient()
    .from('participants')
    .update(updates)
    .eq('id', participantId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating participant:', error);
    throw new Error('Failed to update participant');
  }

  return data;
}

/**
 * Mark certificate as sent
 */
export async function markCertificateSent(participantId) {
  const { data, error} = await getSupabaseClient()
    .from('participants')
    .update({
      certificate_sent: true,
      certificate_sent_at: new Date().toISOString()
    })
    .eq('id', participantId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error marking certificate sent:', error);
    throw new Error('Failed to mark certificate as sent');
  }

  return data;
}

export default getSupabaseClient;
