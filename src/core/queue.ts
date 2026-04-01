/**
 * Bull queue setup for agent action processing.
 *
 * Two queues — read agents run concurrently, write agents run serially.
 * Inspired by Claude Code's StreamingToolExecutor partitioning.
 */

import Queue from 'bull'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

/** Queue for read-only agent tasks (Atlas, Echo, Iris, Reid, Flint, Penny). */
export const readQueue = new Queue('signalos:read-agents', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

/** Queue for write agent tasks (Vega, Roman, Mara, Luca). One at a time. */
export const writeQueue = new Queue('signalos:write-agents', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  limiter: {
    max: 1,
    duration: 1000,
  },
})

/** Priority queue for surge events. Always processed first. */
export const surgeQueue = new Queue('signalos:surge', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
})

export async function closeQueues(): Promise<void> {
  await Promise.all([
    readQueue.close(),
    writeQueue.close(),
    surgeQueue.close(),
  ])
}
