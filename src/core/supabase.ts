/**
 * Supabase client singleton.
 *
 * Service role only — never use the anon key.
 * Used by all agents via BaseAgent and directly by core services.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env'
    )
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  })

  return client
}
