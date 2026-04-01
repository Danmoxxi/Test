/**
 * Moxxi SignalOS — Hardcoded Business Rules
 *
 * These values are non-negotiable. Never override them.
 * If a business rule needs changing, Dan must update this file.
 */

export const BUSINESS_RULES = {
  /** Minimum stay in nights. Never 1. */
  MIN_STAY_NIGHTS: 2,

  /** One-night stays are never permitted. */
  ONE_NIGHT_STAYS_PERMITTED: false,

  /** $1,000 exact rate = Resly mis-sync. Block immediately. */
  RESLY_MISSYNC_RATE: 1000,

  /** Surge tiers at or above this auto-execute without approval. */
  AUTO_EXECUTE_FROM_TIER: 2,

  /** Telegram command to trigger Black Swan. */
  BLACK_SWAN_COMMAND: 'BLACKSWAN',

  /** Hours within which a rollback can be executed. */
  ROLLBACK_WINDOW_HOURS: 72,

  /** Months after which records can be archived. */
  ARCHIVE_AFTER_MONTHS: 6,

  /** Australian financial year starts in July. */
  FINANCIAL_YEAR_START_MONTH: 7,

  /** PriceLabs is reliable within this occupancy band. */
  PRICELABS_EQUILIBRIUM_LOW: 0.49,
  PRICELABS_EQUILIBRIUM_HIGH: 0.54,

  /** Autonomy pattern matching — 90% similarity threshold. */
  AUTONOMY_SIMILARITY_THRESHOLD: 0.90,

  /** Minimum patterns before autonomy can activate. */
  AUTONOMY_MIN_PATTERNS: 5,

  /** Target net ADR premium over long-term rental equivalent. */
  TARGET_NET_ADR_PREMIUM: 0.22,

  /** Resly universal channel multiplier. */
  DEFAULT_CHANNEL_MULTIPLIER: 1.20,

  /** Corporate booking share threshold triggering review drought alert. */
  CORPORATE_DROUGHT_THRESHOLD: 0.60,

  /** Maximum combined discount across all stacked promotions. */
  MAX_STACKED_DISCOUNT_PCT: 0.40,

  /** Direct booking saving percentage vs OTA channels. */
  DIRECT_BOOKING_SAVING_PCT: 0.10,

  /** Maximum local recommendations per region. */
  MAX_LOCAL_RECS_PER_REGION: 30,

  /** Rate sanity floor — no rate below $50. */
  RATE_SANITY_MIN: 50,

  /** Rate sanity ceiling — no rate above historical max × 10. */
  RATE_SANITY_MAX_MULTIPLIER: 10,
} as const

export type BusinessRules = typeof BUSINESS_RULES

/** Surge tier uplift ranges: [min%, max%] */
export const SURGE_TIER_RANGES: Record<number, readonly [number, number]> = {
  1: [0.08, 0.12],
  2: [0.20, 0.35],
  3: [0.35, 0.50],
  4: [0.50, 0.80],
  5: [0.80, 1.50],
  6: [2.00, 3.00],
} as const

/** Event classification multipliers for surge calculation. */
export const EVENT_MULTIPLIERS: Record<string, number> = {
  LOCAL: 1.0,
  INTRASTATE: 1.3,
  INTERSTATE: 1.8,
  EXTREME: 2.5,
} as const

/** Sell-through rate multipliers for surge calculation. */
export const SELL_THROUGH_MULTIPLIERS: readonly { threshold: number; multiplier: number }[] = [
  { threshold: 0.85, multiplier: 3.0 },
  { threshold: 0.70, multiplier: 2.0 },
  { threshold: 0.50, multiplier: 1.5 },
  { threshold: 0.30, multiplier: 1.2 },
  { threshold: 0.00, multiplier: 1.0 },
] as const

/** LOS discount schedules — standard and event/peak. */
export const LOS_DISCOUNTS = {
  standard: {
    4: 0.06,
    5: 0.08,
    7: 0.10,
    14: 0.18,
    28: 0.25,
  },
  event_peak: {
    4: 0.03,
    5: 0.04,
    7: 0.05,
    14: 0.08,
    28: 0.12,
  },
} as const

/** Rate limits — max operations per window. */
export const RATE_LIMITS = {
  BLACK_SWAN_MANUAL: { max: 3, windowSeconds: 86400 },
  SURGE_CHANGES_PER_PROPERTY: { max: 10, windowSeconds: 3600 },
  PRICELABS_WRITES: { max: 100, windowSeconds: 3600 },
  ROLLBACK_OPS: { max: 5, windowSeconds: 3600 },
  TELEGRAM_COMMANDS_PER_USER: { max: 10, windowSeconds: 60 },
} as const
