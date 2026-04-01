/**
 * Jarvis — Primary Orchestrator
 *
 * The conductor — every signal passes through him before anything
 * touches a live property.
 *
 * Subsystems:
 * - Telegram bot (webhook mode)
 * - Queue monitor (60-second polling)
 * - Watchdog (agent health monitoring)
 * - Guardrails (hardcoded rule enforcement)
 * - Rollback (72-hour undo window)
 */

import { Bot } from 'grammy'
import cron from 'node-cron'
import { BaseAgent, type AgentConfig } from '../base/BaseAgent.js'
import { processQueue } from './queue-monitor.js'
import { rollbackAction } from './rollback.js'
import {
  createTelegramBot,
  loadTelegramConfig,
  sendPrivateAlert,
  type TelegramConfig,
} from './telegram.js'
import { checkAllAgentHealth } from './watchdog.js'

export class JarvisAgent extends BaseAgent {
  private bot: Bot | null = null
  private telegramConfig: TelegramConfig | null = null
  private queueInterval: ReturnType<typeof setInterval> | null = null
  private watchdogTask: cron.ScheduledTask | null = null

  constructor() {
    const config: AgentConfig = {
      agentId: 'jarvis',
      agentName: 'Jarvis',
    }
    super(config)
  }

  async start(): Promise<void> {
    this.logger.info('Jarvis starting...')
    this.isRunning = true

    // ── 1. Telegram Bot ──────────────────────────────────
    try {
      this.telegramConfig = await loadTelegramConfig()
      this.bot = createTelegramBot(
        this.telegramConfig,
        this.supabase,
        this.logger
      )
      this.logger.info('Telegram bot initialised')
    } catch (err) {
      this.logger.error('Failed to initialise Telegram bot', {
        error: err instanceof Error ? err.message : String(err),
      })
      // Continue without Telegram — other subsystems still work
    }

    // ── 2. Queue Monitor (60-second polling) ─────────────
    this.queueInterval = setInterval(async () => {
      if (!this.isRunning) return
      try {
        await processQueue({
          supabase: this.supabase,
          logger: this.logger,
          sendTelegramAlert: (msg, urgent) => this.sendAlert(msg, urgent),
        })
      } catch (err) {
        await this.logError(
          err instanceof Error ? err : new Error(String(err)),
          { subsystem: 'queue-monitor' }
        )
      }
    }, 60_000)

    this.logger.info('Queue monitor started (60s interval)')

    // ── 3. Watchdog (every 5 minutes) ────────────────────
    this.watchdogTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const results = await checkAllAgentHealth(this.supabase, this.logger)
        const failed = results.filter(r => r.status === 'failed')
        if (failed.length > 0) {
          const names = failed.map(r => r.agent_id).join(', ')
          await this.sendAlert(
            `🔴 Agent(s) FAILED: ${names}\nNo heartbeat in 15+ minutes.`,
            true
          )
        }
      } catch (err) {
        await this.logError(
          err instanceof Error ? err : new Error(String(err)),
          { subsystem: 'watchdog' }
        )
      }
    })

    this.logger.info('Watchdog started (5m interval)')

    // ── 4. Report healthy ────────────────────────────────
    await this.reportHealth('healthy')
    this.logger.info('Jarvis is online.')
  }

  async stop(): Promise<void> {
    this.logger.info('Jarvis shutting down...')
    this.isRunning = false

    if (this.queueInterval) {
      clearInterval(this.queueInterval)
      this.queueInterval = null
    }

    if (this.watchdogTask) {
      this.watchdogTask.stop()
      this.watchdogTask = null
    }

    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }

    await this.reportHealth('failed')
    this.logger.info('Jarvis stopped.')
  }

  // ── Public API ─────────────────────────────────────────

  async rollback(actionId: string): Promise<{ success: boolean; reason: string }> {
    return rollbackAction(actionId, this.supabase, this.logger)
  }

  // ── Internal Helpers ───────────────────────────────────

  private async sendAlert(message: string, urgent: boolean): Promise<void> {
    if (this.bot && this.telegramConfig) {
      await sendPrivateAlert(this.bot, this.telegramConfig, message, urgent)
    } else {
      // Fallback to logging if Telegram not available
      this.logger.warn(`[ALERT${urgent ? ' URGENT' : ''}] ${message}`)
    }
  }
}
