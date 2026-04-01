/**
 * Supabase Vault — Secrets access.
 *
 * All API keys and credentials live in Vault.
 * Never hardcode. Never cache beyond a single operation.
 */

import { getSupabaseClient } from './supabase.js'

export async function getSecretFromVault(secretName: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .rpc('vault_decrypted_secrets')
    .eq('name', secretName)
    .single()

  if (error || !data) {
    throw new Error(
      `Secret '${secretName}' not found in Vault: ${error?.message ?? 'no data'}`
    )
  }

  const secret = (data as Record<string, unknown>)['decrypted_secret']
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error(`Secret '${secretName}' is empty or invalid`)
  }

  return secret
}
