/**
 * BaseAgent — Every agent extends this.
 *
 * Provides shared infrastructure: Supabase, Anthropic, logging,
 * action logging, health reporting, guardrail checks.
 *
 * Never duplicate core infrastructure. If you need something shared,
 * add it here.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type winston from 'winston'
import { getAnthropicClient } from '../../core/anthropic.js'
import { createLogger } from '../../core/logger.js'
import { getSupabaseClient } from '../../core/supabase.js'
import { BUSINESS_RULES } from '../../types/business-rules.js'
import type {
  ActionPriority,
  AgentId,
  ConfidenceScore,
  HealthStatus,
  PropertyContext,
  Region,
} from '../../types/index.js'

export interface AgentConfig {
  agentId: AgentId
  agentName: string
}

export abstract class BaseAgent {
  protected readonly agentId: AgentId
  protected readonly agentName: string
  protected readonly supabase: SupabaseClient
  protected readonly anthropic: Anthropic
  protected readonly logger: winston.Logger
  protected isRunning: boolean = false

  constructor(config: AgentConfig) {
    this.agentId = config.agentId
    this.agentName = config.agentName
    this.supabase = getSupabaseClient()
    this.anthropic = getAnthropicClient()
    this.logger = createLogger(config.agentId)
  }

  /** Start the agent. Each agent defines its own startup logic. */
  abstract start(): Promise<void>

  /** Gracefully stop the agent. */
  abstract stop(): Promise<void>

  // ── Action Logging ───────────────────────────────────────

  /**
   * Log an action to signalos_agent_actions.
   * Returns the action ID for tracking.
   */
  protected async logAction(action: {
    action_type: string
    target_agents: AgentId[]
    property_id?: string | null
    region?: Region | null
    priority: ActionPriority
    payload: Record<string, unknown>
    reasoning: string
    rollback_payload?: Record<string, unknown> | null
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('signalos_agent_actions')
      .insert({
        agent_id: this.agentId,
        action_type: action.action_type,
        target_agents: action.target_agents,
        property_id: action.property_id ?? null,
        region: action.region ?? null,
        priority: action.priority,
        status: 'pending',
        payload: action.payload,
        reasoning: action.reasoning,
        rollback_payload: action.rollback_payload ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      this.logger.error('Failed to log action', { error: error?.message })
      throw new Error(`Failed to log action: ${error?.message ?? 'no data'}`)
    }

    this.logger.info(`Action logged: ${action.action_type}`, {
      actionId: data['id'],
      priority: action.priority,
    })

    return data['id'] as string
  }

  /**
   * Log to signalos_daily_actions — summary of what happened.
   */
  protected async logDailyAction(action: {
    action_type: string
    property_id?: string | null
    region?: Region | null
    summary: string
    details: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.supabase
      .from('signalos_daily_actions')
      .insert({
        agent_id: this.agentId,
        action_type: action.action_type,
        property_id: action.property_id ?? null,
        region: action.region ?? null,
        summary: action.summary,
        details: action.details,
      })

    if (error) {
      this.logger.error('Failed to log daily action', { error: error.message })
    }
  }

  // ── Alert Logging ────────────────────────────────────────

  protected async logAlert(alert: {
    property_id?: string | null
    region?: Region | null
    severity: 'info' | 'warning' | 'critical'
    title: string
    message: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('signalos_revenue_alerts')
      .insert({
        agent_id: this.agentId,
        property_id: alert.property_id ?? null,
        region: alert.region ?? null,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        acknowledged: false,
      })

    if (error) {
      this.logger.error('Failed to log alert', { error: error.message })
    }
  }

  // ── Error Logging ────────────────────────────────────────

  protected async logError(
    err: Error,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    this.logger.error(err.message, { stack: err.stack, ...context })

    const { error } = await this.supabase
      .from('signalos_error_log')
      .insert({
        agent_id: this.agentId,
        error_type: err.constructor.name,
        message: err.message,
        stack: err.stack ?? null,
        context,
        resolved: false,
      })

    if (error) {
      // Last resort — can't even log the error to Supabase
      this.logger.error('Failed to log error to database', {
        originalError: err.message,
        dbError: error.message,
      })
    }
  }

  // ── Property Context ─────────────────────────────────────

  protected async getPropertyContext(
    propertyId: string
  ): Promise<PropertyContext | null> {
    const { data, error } = await this.supabase
      .from('signalos_property_context')
      .select('*')
      .eq('property_id', propertyId)
      .single()

    if (error || !data) return null
    return data as PropertyContext
  }

  // ── Confidence Score ─────────────────────────────────────

  protected async getLatestConfidenceScore(
    propertyId: string
  ): Promise<ConfidenceScore | null> {
    const { data, error } = await this.supabase
      .from('signalos_property_confidence_scores')
      .select('*')
      .eq('property_id', propertyId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return data as ConfidenceScore
  }

  // ── Guardrail Checks ────────────────────────────────────

  /** Returns true if the rate is above the property's floor. */
  protected checkFloorProtection(proposedRate: number, floor: number): boolean {
    return proposedRate >= floor
  }

  /** Returns true if the stay meets the minimum night requirement. */
  protected checkMinimumStay(nights: number): boolean {
    return nights >= BUSINESS_RULES.MIN_STAY_NIGHTS
  }

  /** Returns true if the rate passes all sanity checks. */
  protected checkRateSanity(
    rate: number,
    floor: number,
    historicalMax?: number
  ): { passed: boolean; reason?: string } {
    if (rate === BUSINESS_RULES.RESLY_MISSYNC_RATE) {
      return { passed: false, reason: 'Rate is exactly $1,000 — Resly mis-sync detected' }
    }
    if (rate < BUSINESS_RULES.RATE_SANITY_MIN) {
      return { passed: false, reason: `Rate $${rate} below operational minimum $${BUSINESS_RULES.RATE_SANITY_MIN}` }
    }
    if (rate < floor) {
      return { passed: false, reason: `Rate $${rate} below floor $${floor}` }
    }
    if (historicalMax && rate > historicalMax * BUSINESS_RULES.RATE_SANITY_MAX_MULTIPLIER) {
      return { passed: false, reason: `Rate $${rate} exceeds sanity ceiling (${historicalMax} × ${BUSINESS_RULES.RATE_SANITY_MAX_MULTIPLIER})` }
    }
    return { passed: true }
  }

  // ── Health Reporting ─────────────────────────────────────

  protected async reportHealth(status: HealthStatus): Promise<void> {
    const { error } = await this.supabase
      .from('signalos_agent_health')
      .upsert(
        {
          agent_id: this.agentId,
          status,
          last_heartbeat: new Date().toISOString(),
        },
        { onConflict: 'agent_id' }
      )

    if (error) {
      this.logger.error('Failed to report health', { error: error.message })
    }
  }
}
