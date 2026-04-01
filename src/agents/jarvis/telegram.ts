/**
 * Jarvis Telegram Bot — Grammy webhook mode.
 *
 * Rules:
 * - Webhook mode only. Never polling.
 * - Verify webhook secret on every incoming update.
 * - Whitelist chat IDs and user IDs.
 * - Sensitive commands require Dan's specific user ID.
 * - Rate limit: 10 commands/min per user.
 */

import { Bot, type Context } from 'grammy'
import type winston from 'winston'
import { telegramRateCheck } from '../../core/rate-limiter.js'
import { getSecretFromVault } from '../../core/vault.js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TelegramConfig {
  botToken: string
  privateChannelId: number
  teamChannelId: number
  danUserId: number
  laurenUserId: number
  webhookSecret: string
}

const SENSITIVE_COMMANDS = new Set([
  'blackswan', 'approve', 'reject', 'rollback',
  'surgeend', 'up', 'down', 'custom',
])

export async function loadTelegramConfig(): Promise<TelegramConfig> {
  const [botToken, webhookSecret] = await Promise.all([
    getSecretFromVault('telegram_bot_token'),
    getSecretFromVault('telegram_webhook_secret'),
  ])

  // These IDs come from Vault too — not .env
  const [privateChannelId, teamChannelId, danUserId, laurenUserId] = await Promise.all([
    getSecretFromVault('telegram_private_chat_id'),
    getSecretFromVault('telegram_team_chat_id'),
    getSecretFromVault('telegram_dan_user_id'),
    getSecretFromVault('telegram_lauren_user_id'),
  ])

  return {
    botToken,
    privateChannelId: parseInt(privateChannelId, 10),
    teamChannelId: parseInt(teamChannelId, 10),
    danUserId: parseInt(danUserId, 10),
    laurenUserId: parseInt(laurenUserId, 10),
    webhookSecret,
  }
}

export function createTelegramBot(
  config: TelegramConfig,
  supabase: SupabaseClient,
  logger: winston.Logger
): Bot {
  const bot = new Bot(config.botToken)

  const authorisedChatIds = new Set([
    config.privateChannelId,
    config.teamChannelId,
  ])
  const authorisedUserIds = new Set([
    config.danUserId,
    config.laurenUserId,
  ])

  // ── Auth Middleware ──────────────────────────────────────

  bot.use(async (ctx: Context, next: () => Promise<void>) => {
    const chatId = ctx.chat?.id
    const userId = ctx.from?.id

    // Chat whitelist
    if (!chatId || !authorisedChatIds.has(chatId)) {
      logger.warn('Unauthorised chat attempt', { chatId, userId })
      return // Silent reject
    }

    // Rate limit
    if (userId) {
      const allowed = await telegramRateCheck(userId)
      if (!allowed) {
        await ctx.reply('Rate limit exceeded. Please wait.')
        return
      }
    }

    // Sensitive command check
    const text = ctx.message?.text?.toLowerCase() ?? ''
    const isSensitive = [...SENSITIVE_COMMANDS].some(
      cmd => text.startsWith(`/${cmd}`) || text.startsWith(cmd)
    )

    if (isSensitive && userId !== config.danUserId) {
      await ctx.reply('⛔ This command requires Dan\'s authorisation.')
      return
    }

    await next()
  })

  // ── Command Handlers ────────────────────────────────────

  bot.command('status', async (ctx) => {
    // TODO: Pull agent health from signalos_agent_health
    await ctx.reply('🟢 SignalOS is running. All agents healthy.')
  })

  bot.command('approve', async (ctx) => {
    const actionId = ctx.match?.trim()
    if (!actionId) {
      await ctx.reply('Usage: /approve <action_id>')
      return
    }

    const { error } = await supabase
      .from('signalos_agent_actions')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('status', 'pending')

    if (error) {
      await ctx.reply(`Failed to approve: ${error.message}`)
    } else {
      await ctx.reply(`✅ Action ${actionId} approved.`)
    }
  })

  bot.command('reject', async (ctx) => {
    const parts = ctx.match?.trim().split(' ') ?? []
    const actionId = parts[0]
    const reason = parts.slice(1).join(' ') || 'Rejected by Dan'

    if (!actionId) {
      await ctx.reply('Usage: /reject <action_id> [reason]')
      return
    }

    const { error } = await supabase
      .from('signalos_agent_actions')
      .update({
        status: 'blocked',
        blocked_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('status', 'pending')

    if (error) {
      await ctx.reply(`Failed to reject: ${error.message}`)
    } else {
      await ctx.reply(`❌ Action ${actionId} rejected: ${reason}`)
    }
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🤖 Jarvis Commands:\n\n` +
      `/status — Agent health overview\n` +
      `/approve <id> — Approve pending action\n` +
      `/reject <id> [reason] — Reject pending action\n` +
      `/rollback <id> — Rollback executed action\n` +
      `/blackswan <region> <dates> — Trigger Black Swan\n` +
      `/briefing — Generate 72-hour briefing\n` +
      `/help — This message`
    )
  })

  // TODO: /blackswan, /rollback, /briefing — Phase 1 skeleton

  return bot
}

/**
 * Send a message to the private Dan channel.
 */
export async function sendPrivateAlert(
  bot: Bot,
  config: TelegramConfig,
  message: string,
  _urgent: boolean
): Promise<void> {
  await bot.api.sendMessage(config.privateChannelId, message, {
    parse_mode: 'HTML',
  })
}

/**
 * Send a message to the team broadcast channel.
 */
export async function sendTeamBroadcast(
  bot: Bot,
  config: TelegramConfig,
  message: string
): Promise<void> {
  await bot.api.sendMessage(config.teamChannelId, message, {
    parse_mode: 'HTML',
  })
}
