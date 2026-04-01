/**
 * Moxxi SignalOS — Core Type Definitions
 *
 * All shared types live here. Agent-specific types live in their own folders.
 * No `any` types. Ever.
 */

// ── Regions ──────────────────────────────────────────────

export type Region =
  | 'launceston'
  | 'northwest'
  | 'northeast'
  | 'east_coast'
  | 'hobart'

export const REGIONS: readonly Region[] = [
  'launceston',
  'northwest',
  'northeast',
  'east_coast',
  'hobart',
] as const

// ── Agent Identity ───────────────────────────────────────

export type AgentId =
  | 'jarvis'
  | 'atlas'
  | 'vega'
  | 'echo'
  | 'flint'
  | 'penny'
  | 'sharon'
  | 'iris'
  | 'roman'
  | 'mara'
  | 'luca'
  | 'reid'

export type AgentLayer = 'coordination' | 'intelligence' | 'content' | 'execution'

export const AGENT_LAYERS: Record<AgentId, AgentLayer> = {
  jarvis: 'coordination',
  atlas: 'intelligence',
  vega: 'intelligence',
  echo: 'intelligence',
  flint: 'content',
  penny: 'content',
  sharon: 'content',
  iris: 'intelligence',
  roman: 'execution',
  mara: 'execution',
  luca: 'execution',
  reid: 'intelligence',
} as const

// ── Agent Actions (the queue) ────────────────────────────

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'blocked'
  | 'executed'
  | 'failed'
  | 'rolled_back'

export type ActionPriority = 'low' | 'medium' | 'high' | 'critical'

export interface AgentAction {
  id: string
  agent_id: AgentId
  action_type: string
  target_agents: AgentId[]
  property_id: string | null
  region: Region | null
  priority: ActionPriority
  status: ActionStatus
  payload: Record<string, unknown>
  reasoning: string
  blocked_reason: string | null
  created_at: string
  updated_at: string
  executed_at: string | null
  rollback_payload: Record<string, unknown> | null
}

// ── Agent Health ─────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'failed'

export interface AgentHealthReport {
  agent_id: AgentId
  status: HealthStatus
  last_heartbeat: string
  last_action_at: string | null
  error_count_1h: number
  details: Record<string, unknown>
}

// ── Alerts ───────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface RevenueAlert {
  id: string
  agent_id: AgentId
  property_id: string | null
  region: Region | null
  severity: AlertSeverity
  title: string
  message: string
  acknowledged: boolean
  created_at: string
}

// ── Surge Pricing ────────────────────────────────────────

export enum SurgeTier {
  STANDARD = 1,
  STRONG = 2,
  HIGH = 3,
  SURGE = 4,
  MAXIMUM_SURGE = 5,
  BLACK_SWAN = 6,
}

export const SURGE_TIER_NAMES: Record<SurgeTier, string> = {
  [SurgeTier.STANDARD]: 'Standard',
  [SurgeTier.STRONG]: 'Strong',
  [SurgeTier.HIGH]: 'High',
  [SurgeTier.SURGE]: 'Surge',
  [SurgeTier.MAXIMUM_SURGE]: 'Maximum Surge',
  [SurgeTier.BLACK_SWAN]: 'Black Swan',
}

// ── Event Classification ─────────────────────────────────

export type EventClassification = 'LOCAL' | 'INTRASTATE' | 'INTERSTATE' | 'EXTREME'

export interface CalendarEvent {
  id: string
  name: string
  region: Region
  classification: EventClassification
  start_date: string
  end_date: string
  source: string
  confidence: number
  compound_event_ids: string[]
  created_at: string
  updated_at: string
}

// ── Property Context ─────────────────────────────────────

export interface PropertyContext {
  property_id: string
  property_name: string
  region: Region
  cohort: string
  floor_rate: number
  ceiling_rate: number | null
  bedrooms: number
  max_guests: number
  is_active: boolean
  pricelabs_listing_id: string | null
  airbnb_listing_id: string | null
  bcom_listing_id: string | null
  vrbo_listing_id: string | null
}

// ── Confidence Score (Iris) ──────────────────────────────

export interface ConfidenceScore {
  property_id: string
  composite_score: number
  airbnb_score: number | null
  bcom_score: number | null
  vrbo_score: number | null
  status: 'exceptional' | 'strong' | 'caution' | 'at_risk' | 'critical'
  calculated_at: string
}

// ── Daily Action Summary ─────────────────────────────────

export interface DailyAction {
  id: string
  agent_id: AgentId
  action_type: string
  property_id: string | null
  region: Region | null
  summary: string
  details: Record<string, unknown>
  created_at: string
}

// ── Error Log ────────────────────────────────────────────

export interface ErrorLogEntry {
  id: string
  agent_id: AgentId
  error_type: string
  message: string
  stack: string | null
  context: Record<string, unknown>
  resolved: boolean
  created_at: string
}
