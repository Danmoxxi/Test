/**
 * Moxxi SignalOS — Entry Point
 *
 * Starts all active agents for the current build phase.
 * Phase 1: Jarvis + Echo (skeleton)
 */

import { JarvisAgent } from './agents/jarvis/index.js'
import { createLogger } from './core/logger.js'

const logger = createLogger('system')

async function main(): Promise<void> {
  logger.info('╔═══════════════════════════════════════╗')
  logger.info('║      Moxxi SignalOS v1.0.0            ║')
  logger.info('║      Phase 1 — Foundation             ║')
  logger.info('╚═══════════════════════════════════════╝')

  // ── Phase 1 Agents ─────────────────────────────────────
  const jarvis = new JarvisAgent()

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Shutting down...`)
    await jarvis.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  // Start agents
  try {
    await jarvis.start()
    logger.info('All Phase 1 agents started.')
  } catch (err) {
    logger.error('Fatal startup error', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error:', err)
  process.exit(1)
})
