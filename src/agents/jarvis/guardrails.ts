/**
 * Jarvis Guardrails — Last line of defence.
 *
 * Every action passes through these checks before approval.
 * These rules are hardcoded and non-negotiable.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS_RULES } from '../../types/business-rules.js'
import type {
  AgentAction,
  AgentId,
  ConfidenceScore,
} from '../../types/index.js'

export interface GuardrailResult {
  passed: boolean
  blocked_reason: string | null
  escalate_to_dan: boolean
}

/**
 * Run all guardrail checks on an action.
 * Returns immediately on first failure — fail fast.
 */
export async function checkGuardrails(
  action: AgentAction,
  supabase: SupabaseClient
): Promise<GuardrailResult> {
  const checks = [
    checkOneNightStay(action),
    checkReslyMissync(action),
    checkManualPriceChange(action),
    checkBulkAction(action),
    await checkIrisGate(action, supabase),
    checkCooldown(action),
    checkSurgeTierAutoApprove(action),
  ]

  for (const check of checks) {
    if (!check.passed) return check
  }

  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

// ── Individual Guardrail Checks ──────────────────────────

function checkOneNightStay(action: AgentAction): GuardrailResult {
  const payload = action.payload
  const nights = payload['min_stay'] ?? payload['nights']
  if (typeof nights === 'number' && nights < BUSINESS_RULES.MIN_STAY_NIGHTS) {
    return {
      passed: false,
      blocked_reason: `1-night stay blocked. Minimum is ${BUSINESS_RULES.MIN_STAY_NIGHTS} nights.`,
      escalate_to_dan: false,
    }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

function checkReslyMissync(action: AgentAction): GuardrailResult {
  const rate = action.payload['rate'] ?? action.payload['proposed_rate']
  if (typeof rate === 'number' && rate === BUSINESS_RULES.RESLY_MISSYNC_RATE) {
    return {
      passed: false,
      blocked_reason: `Rate exactly $${BUSINESS_RULES.RESLY_MISSYNC_RATE} — Resly mis-sync detected. Blocked.`,
      escalate_to_dan: true,
    }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

function checkManualPriceChange(action: AgentAction): GuardrailResult {
  if (action.action_type !== 'price_change') {
    return { passed: true, blocked_reason: null, escalate_to_dan: false }
  }

  const changePct = action.payload['change_pct']
  if (typeof changePct === 'number' && Math.abs(changePct) > 0.20) {
    // Check if this is a surge action — surges have their own approval path
    const surgeTier = action.payload['surge_tier']
    if (typeof surgeTier === 'number' && surgeTier >= BUSINESS_RULES.AUTO_EXECUTE_FROM_TIER) {
      return { passed: true, blocked_reason: null, escalate_to_dan: false }
    }
    return {
      passed: false,
      blocked_reason: `Manual price change >20% (${Math.round(Math.abs(changePct) * 100)}%). Escalated to Dan.`,
      escalate_to_dan: true,
    }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

function checkBulkAction(action: AgentAction): GuardrailResult {
  const propertyCount = action.payload['property_count']
  const propertyIds = action.payload['property_ids']
  const count = typeof propertyCount === 'number'
    ? propertyCount
    : Array.isArray(propertyIds)
      ? propertyIds.length
      : 0

  if (count > 10) {
    return {
      passed: false,
      blocked_reason: `Bulk action affecting ${count} properties. Escalated to Dan.`,
      escalate_to_dan: true,
    }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

async function checkIrisGate(
  action: AgentAction,
  supabase: SupabaseClient
): Promise<GuardrailResult> {
  // Iris gate only applies to pricing increases
  if (action.action_type !== 'price_change') {
    return { passed: true, blocked_reason: null, escalate_to_dan: false }
  }
  const changePct = action.payload['change_pct']
  if (typeof changePct !== 'number' || changePct <= 0) {
    return { passed: true, blocked_reason: null, escalate_to_dan: false }
  }

  if (!action.property_id) {
    return { passed: true, blocked_reason: null, escalate_to_dan: false }
  }

  const { data } = await supabase
    .from('signalos_property_confidence_scores')
    .select('composite_score')
    .eq('property_id', action.property_id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  const score = data as ConfidenceScore | null
  if (score && score.composite_score < 4.0) {
    return {
      passed: false,
      blocked_reason: `Iris confidence score ${score.composite_score} < 4.0. Price increase suppressed.`,
      escalate_to_dan: false,
    }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

function checkCooldown(_action: AgentAction): GuardrailResult {
  // TODO: Phase 2 — check 14-day settling period
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

function checkSurgeTierAutoApprove(action: AgentAction): GuardrailResult {
  const surgeTier = action.payload['surge_tier']
  if (typeof surgeTier === 'number' && surgeTier >= BUSINESS_RULES.AUTO_EXECUTE_FROM_TIER) {
    // Surge tiers 2+ auto-approve immediately — return passed
    // The queue monitor will auto-approve these
    return { passed: true, blocked_reason: null, escalate_to_dan: false }
  }
  return { passed: true, blocked_reason: null, escalate_to_dan: false }
}

// ── Escalation Checks (always require Dan) ───────────────

const ALWAYS_ESCALATE_ACTIONS: Set<string> = new Set([
  'new_property_onboarding',
  'genius_level_3',
  'owner_report_send',
])

export function requiresDanApproval(action: AgentAction): boolean {
  if (ALWAYS_ESCALATE_ACTIONS.has(action.action_type)) return true

  // Surge tiers 2+ auto-execute — do NOT escalate
  const surgeTier = action.payload['surge_tier']
  if (typeof surgeTier === 'number' && surgeTier >= BUSINESS_RULES.AUTO_EXECUTE_FROM_TIER) {
    return false
  }

  return false
}

export function isSurgeAutoApprove(action: AgentAction): boolean {
  const surgeTier = action.payload['surge_tier']
  return typeof surgeTier === 'number' && surgeTier >= BUSINESS_RULES.AUTO_EXECUTE_FROM_TIER
}
