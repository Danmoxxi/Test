-- Migration 001: Foundation Tables
-- Run this first. All other migrations depend on these tables.
-- Never modify existing Moxxi tables (reservations, properties).

-- ═══════════════════════════════════════════════════════════
-- Agent Actions — the central queue. Every signal goes through here.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_agents JSONB NOT NULL DEFAULT '[]',
  property_id TEXT,
  region TEXT CHECK (region IN ('launceston', 'northwest', 'northeast', 'east_coast', 'hobart')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked', 'executed', 'failed', 'rolled_back')),
  payload JSONB NOT NULL DEFAULT '{}',
  reasoning TEXT NOT NULL DEFAULT '',
  blocked_reason TEXT,
  rollback_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON signalos_agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON signalos_agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_property_id ON signalos_agent_actions(property_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON signalos_agent_actions(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Daily Actions — summary log of what happened each day.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_daily_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  property_id TEXT,
  region TEXT CHECK (region IN ('launceston', 'northwest', 'northeast', 'east_coast', 'hobart')),
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_actions_agent_id ON signalos_daily_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_daily_actions_created_at ON signalos_daily_actions(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Revenue Alerts — system-wide alerts and notifications.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_revenue_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  property_id TEXT,
  region TEXT CHECK (region IN ('launceston', 'northwest', 'northeast', 'east_coast', 'hobart')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_alerts_severity ON signalos_revenue_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_revenue_alerts_acknowledged ON signalos_revenue_alerts(acknowledged);

-- ═══════════════════════════════════════════════════════════
-- Property Context — per-property configuration and metadata.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_property_context (
  property_id TEXT PRIMARY KEY,
  property_name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('launceston', 'northwest', 'northeast', 'east_coast', 'hobart')),
  cohort TEXT NOT NULL DEFAULT '2BR',
  floor_rate NUMERIC NOT NULL DEFAULT 80,
  ceiling_rate NUMERIC,
  bedrooms INTEGER NOT NULL DEFAULT 2,
  max_guests INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pricelabs_listing_id TEXT,
  airbnb_listing_id TEXT,
  bcom_listing_id TEXT,
  vrbo_listing_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_context_region ON signalos_property_context(region);
CREATE INDEX IF NOT EXISTS idx_property_context_active ON signalos_property_context(is_active);

-- ═══════════════════════════════════════════════════════════
-- Property Blocks — maintenance, owner stays, etc.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_property_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('maintenance', 'owner_stay', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_blocks_property_id ON signalos_property_blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_property_blocks_dates ON signalos_property_blocks(start_date, end_date);

-- ═══════════════════════════════════════════════════════════
-- Error Log — structured error tracking for all agents.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_error_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_agent_id ON signalos_error_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON signalos_error_log(resolved);

-- ═══════════════════════════════════════════════════════════
-- Manual Override Log — tracks all manual interventions.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_manual_override_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID REFERENCES signalos_agent_actions(id),
  override_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  executed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- Agent Health — heartbeat tracking for watchdog.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_agent_health (
  agent_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failed')),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'
);

-- ═══════════════════════════════════════════════════════════
-- Confidence Scores (Iris) — gates pricing and promotions.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signalos_property_confidence_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT NOT NULL,
  composite_score NUMERIC NOT NULL,
  airbnb_score NUMERIC,
  bcom_score NUMERIC,
  vrbo_score NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('exceptional', 'strong', 'caution', 'at_risk', 'critical')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confidence_scores_property ON signalos_property_confidence_scores(property_id);
CREATE INDEX IF NOT EXISTS idx_confidence_scores_calculated ON signalos_property_confidence_scores(calculated_at DESC);
