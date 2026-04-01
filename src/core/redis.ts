/**
 * Redis client singleton.
 *
 * Used for Bull queues and rate limiting.
 */

import { Redis } from 'ioredis'

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (redisClient) return redisClient

  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 5) return null // stop retrying
      return Math.min(times * 200, 2000)
    },
  })

  return redisClient
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
