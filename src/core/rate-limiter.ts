/**
 * Rate limiter using Redis.
 *
 * Every external write operation must be rate-limited before execution.
 * See RATE_LIMITS in business-rules.ts for configured limits.
 */

import { getRedisClient } from './redis.js'

export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const redis = getRedisClient()
  const fullKey = `signalos:ratelimit:${key}`

  const current = await redis.incr(fullKey)
  if (current === 1) {
    await redis.expire(fullKey, windowSeconds)
  }
  return current <= max
}

/** PriceLabs write operations: max 100/hour. */
export function pricelabsRateCheck(listingId: string): Promise<boolean> {
  return checkRateLimit(`pricelabs:${listingId}`, 100, 3600)
}

/** Telegram commands per user: max 10/minute. */
export function telegramRateCheck(userId: number): Promise<boolean> {
  return checkRateLimit(`telegram:${userId}`, 10, 60)
}

/** Black Swan manual triggers: max 3/day. */
export function blackSwanRateCheck(): Promise<boolean> {
  return checkRateLimit('blackswan:manual', 3, 86400)
}

/** Surge tier changes per property: max 10/hour. */
export function surgeChangesRateCheck(propertyId: string): Promise<boolean> {
  return checkRateLimit(`surge:${propertyId}`, 10, 3600)
}

/** Rollback operations: max 5/hour. */
export function rollbackRateCheck(): Promise<boolean> {
  return checkRateLimit('rollback:global', 5, 3600)
}
