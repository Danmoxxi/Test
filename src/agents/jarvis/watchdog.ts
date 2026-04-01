/**
 * Jarvis Watchdog — Agent health monitoring.
 *
 * Checks every agent's last heartbeat. If an agent hasn't reported
 * in 5 minutes, flag as degraded. 15 minutes = failed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type winston from 'winston'
import type { AgentId, HealthStatus } from '../../types/index.js'

const DEGRADED_THRESHOLD_MS = 5 * 60 * 1000   // 5 minutes
const FAILED_THRESHOLD_MS = 15 * 60 * 1000     // 15 minutes

export interface WatchdogResult {
  agent_id: AgentId
  status: HealthStatus
  last_heartbeat: string | null
  silent_ms: number
}

export async function checkAllAgentHealth(
  supabase: SupabaseClient,
  logger: winston.Logger
): Promise<WatchdogResult[]> {
  const { data, error } = await supabase
    .from('signalos_agent_health')
    .select('*')

  if (error || !data) {
    logger.error('Watchdog: failed to fetch agent health', { error: error?.message })
    return []
  }

  const now = Date.now()
  const results: WatchdogResult[] = []

  for (const row of data as { agent_id: AgentId; status: HealthStatus; last_heartbeat: string }[]) {
    const lastBeat = new Date(row.last_heartbeat).getTime()
    const silentMs = now - lastBeat

    let effectiveStatus: HealthStatus = row.status
    if (silentMs > FAILED_THRESHOLD_MS) {
      effectiveStatus = 'failed'
    } else if (silentMs > DEGRADED_THRESHOLD_MS) {
      effectiveStatus = 'degraded'
    }

    if (effectiveStatus !== row.status) {
      // Update the status in the database
      await supabase
        .from('signalos_agent_health')
        .update({ status: effectiveStatus })
        .eq('agent_id', row.agent_id)
    }

    results.push({
      agent_id: row.agent_id,
      status: effectiveStatus,
      last_heartbeat: row.last_heartbeat,
      silent_ms: silentMs,
    })
  }

  // Log any degraded or failed agents
  const unhealthy = results.filter(r => r.status !== 'healthy')
  if (unhealthy.length > 0) {
    logger.warn('Watchdog: unhealthy agents detected', {
      agents: unhealthy.map(r => ({ id: r.agent_id, status: r.status })),
    })
  }

  return results
}
