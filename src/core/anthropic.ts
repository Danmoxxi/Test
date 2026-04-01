/**
 * Anthropic client singleton.
 *
 * API key loaded from environment (bootstrapped from Vault in production).
 * Model configured centrally — agents never specify their own model.
 */

import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (client) return client

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY must be set')
  }

  client = new Anthropic({ apiKey })
  return client
}

export function getModel(): string {
  return process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL
}
