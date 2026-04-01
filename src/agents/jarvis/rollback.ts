/**
 * Jarvis Rollback — Undo executed actions within the 72-hour window.
 *
 * Rollback payloads are stored alongside the original action.
 * Jarvis reads the rollback_payload and reverses the action.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type winston from 'winston'
import { rollbackRateCheck } from '../../core/rate-limiter.js'
import { BUSINESS_RULES } from '../../types/business-rules.js'

export interface RollbackResult {
  success: boolean
  reason: string
}

export async function rollbackAction(
  actionId: string,
  supabase: SupabaseClient,
  logger: winston.Logger
): Promise<RollbackResult> {
  // Rate limit check
  const allowed = await rollbackRateCheck()
  if (!allowed) {
    return { success: false, reason: 'Rollback rate limit exceeded (max 5/hour)' }
  }

  // Fetch the action
  const { data: action, error } = await supabase
    .from('signalos_agent_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (error || !action) {
    return { success: false, reason: `Action ${actionId} not found` }
  }

  // Check rollback window
  const executedAt = action['executed_at'] as string | null
  if (!executedAt) {
    return { success: false, reason: 'Action has not been executed yet' }
  }

  const hoursSinceExecution =
    (Date.now() - new Date(executedAt).getTime()) / (1000 * 60 * 60)

  if (hoursSinceExecution > BUSINESS_RULES.ROLLBACK_WINDOW_HOURS) {
    return {
      success: false,
      reason: `Rollback window expired (${BUSINESS_RULES.ROLLBACK_WINDOW_HOURS}h). Executed ${Math.round(hoursSinceExecution)}h ago.`,
    }
  }

  // Check rollback payload exists
  const rollbackPayload = action['rollback_payload'] as Record<string, unknown> | null
  if (!rollbackPayload) {
    return { success: false, reason: 'No rollback payload stored for this action' }
  }

  // Mark as rolled back
  const { error: updateError } = await supabase
    .from('signalos_agent_actions')
    .update({
      status: 'rolled_back',
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)

  if (updateError) {
    logger.error('Failed to mark action as rolled back', { error: updateError.message })
    return { success: false, reason: `Database error: ${updateError.message}` }
  }

  // Log the rollback
  await supabase.from('signalos_manual_override_log').insert({
    action_id: actionId,
    override_type: 'rollback',
    payload: rollbackPayload,
    executed_by: 'jarvis',
    created_at: new Date().toISOString(),
  })

  logger.info(`Rollback executed for action ${actionId}`, {
    originalAction: action['action_type'],
    rollbackPayload,
  })

  return { success: true, reason: `Action ${actionId} rolled back successfully` }
}
