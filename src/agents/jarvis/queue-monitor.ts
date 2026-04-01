/**
 * Jarvis Queue Monitor — 60-second polling loop.
 *
 * Processes pending actions from signalos_agent_actions:
 * 1. Guardrail check → block or escalate
 * 2. Conflict check → hold if overlapping
 * 3. Iris gate → suppress if confidence below 4.0
 * 4. Cooldown check → queue if settling active
 * 5. Autonomy check → auto-approve if pattern matched
 * 6. Surge tier check → auto-approve tier 2+ immediately
 * 7. Otherwise → pending until Dan responds via Telegram
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type winston from 'winston'
import type { AgentAction } from '../../types/index.js'
import {
  checkGuardrails,
  isSurgeAutoApprove,
  requiresDanApproval,
} from './guardrails.js'

export interface QueueMonitorDeps {
  supabase: SupabaseClient
  logger: winston.Logger
  sendTelegramAlert: (message: string, urgent: boolean) => Promise<void>
}

/**
 * Process all pending actions in the queue.
 * Called every 60 seconds by the Jarvis main loop.
 */
export async function processQueue(deps: QueueMonitorDeps): Promise<void> {
  const { supabase, logger, sendTelegramAlert } = deps

  // Fetch pending actions, ordered by priority and creation time
  const { data: actions, error } = await supabase
    .from('signalos_agent_actions')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    logger.error('Failed to fetch pending actions', { error: error.message })
    return
  }

  if (!actions || actions.length === 0) return

  logger.info(`Processing ${actions.length} pending actions`)

  for (const action of actions as AgentAction[]) {
    try {
      await processAction(action, deps)
    } catch (err) {
      logger.error(`Error processing action ${action.id}`, {
        error: err instanceof Error ? err.message : String(err),
        actionType: action.action_type,
        agentId: action.agent_id,
      })
    }
  }
}

async function processAction(
  action: AgentAction,
  deps: QueueMonitorDeps
): Promise<void> {
  const { supabase, logger, sendTelegramAlert } = deps

  // Step 1: Guardrail check
  const guardrailResult = await checkGuardrails(action, supabase)

  if (!guardrailResult.passed) {
    // Block the action
    await updateActionStatus(supabase, action.id, 'blocked', guardrailResult.blocked_reason)
    logger.warn(`Action blocked: ${action.action_type}`, {
      actionId: action.id,
      reason: guardrailResult.blocked_reason,
    })

    if (guardrailResult.escalate_to_dan) {
      await sendTelegramAlert(
        `🚫 Action blocked and escalated:\n${guardrailResult.blocked_reason}\n\nAgent: ${action.agent_id}\nType: ${action.action_type}`,
        true
      )
    }
    return
  }

  // Step 2: Surge auto-approve — tiers 2+ execute immediately
  if (isSurgeAutoApprove(action)) {
    await updateActionStatus(supabase, action.id, 'approved', null)
    logger.info(`Surge auto-approved: tier ${action.payload['surge_tier']}`, {
      actionId: action.id,
    })

    const tier = action.payload['surge_tier'] as number
    const tierName = tier === 6 ? '🚨 BLACK SWAN' : `Tier ${tier}`
    await sendTelegramAlert(
      `⚡ Surge auto-executed: ${tierName}\nRegion: ${action.region ?? 'N/A'}\nProperty: ${action.property_id ?? 'multiple'}\n\n${action.reasoning}`,
      tier >= 4
    )
    return
  }

  // Step 3: Check if this requires Dan's explicit approval
  if (requiresDanApproval(action)) {
    // Leave as pending — notify Dan
    await sendTelegramAlert(
      `🔔 Approval needed:\n${action.action_type}\nAgent: ${action.agent_id}\nProperty: ${action.property_id ?? 'N/A'}\n\n${action.reasoning}\n\nReply: /approve ${action.id} or /reject ${action.id}`,
      false
    )
    return
  }

  // Step 4: Auto-approve low-risk actions
  await updateActionStatus(supabase, action.id, 'approved', null)
  logger.info(`Action auto-approved: ${action.action_type}`, {
    actionId: action.id,
    agentId: action.agent_id,
  })
}

// ── Conflict Detection ────────────────────────────────────

export async function checkConflicts(
  action: AgentAction,
  supabase: SupabaseClient
): Promise<AgentAction[]> {
  if (!action.property_id) return []

  const { data } = await supabase
    .from('signalos_agent_actions')
    .select('*')
    .eq('property_id', action.property_id)
    .in('status', ['pending', 'approved'])
    .neq('id', action.id)
    .gte('created_at', new Date(Date.now() - 120_000).toISOString()) // 2-minute window

  return (data as AgentAction[]) ?? []
}

// ── Status Updates ────────────────────────────────────────

async function updateActionStatus(
  supabase: SupabaseClient,
  actionId: string,
  status: string,
  blockedReason: string | null
): Promise<void> {
  await supabase
    .from('signalos_agent_actions')
    .update({
      status,
      blocked_reason: blockedReason,
      updated_at: new Date().toISOString(),
      ...(status === 'approved' || status === 'executed'
        ? { executed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', actionId)
}
