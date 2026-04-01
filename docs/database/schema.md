# SignalOS Database Schema

## Supabase Project
- **ID:** sofxjevxwlfbsruitscr
- **Name:** Moxxi_DB_V2

## Rules
- All SignalOS tables use `signalos_` prefix
- Existing tables (`reservations`, `properties`) are READ-ONLY
- Service role key only — never anon
- Never delete from critical tables — archive instead

## Foundation Tables (Migration 001)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_agent_actions` | Jarvis | Central action queue |
| `signalos_daily_actions` | All agents | Daily action summary |
| `signalos_revenue_alerts` | All agents | System-wide alerts |
| `signalos_property_context` | System | Per-property config |
| `signalos_property_blocks` | System | Maintenance/owner stays |
| `signalos_error_log` | All agents | Error tracking |
| `signalos_manual_override_log` | Jarvis | Manual interventions |
| `signalos_agent_health` | Jarvis | Agent heartbeats |
| `signalos_property_confidence_scores` | Iris | Confidence scores |

## Intelligence Tables (Migration 002 — Phase 2)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_events_calendar` | Atlas | Event database |
| `signalos_external_signals` | Atlas | BOM, TT-Line, RBA |
| `signalos_local_recommendations` | Atlas | Local activity recs |
| `signalos_property_market_data` | Reid | Market benchmarks |
| `signalos_channel_mix` | Iris | Channel distribution |
| `signalos_effective_rates` | Vega | Rate history |
| `signalos_content_calendar` | Flint | Content schedule |
| `signalos_booking_window_profiles` | Echo | Booking window data |

## Review Tables (Migration 003 — Phase 2)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_reviews_airbnb` | Iris | Airbnb reviews |
| `signalos_reviews_bcom` | Iris | Booking.com reviews |
| `signalos_reviews_vrbo` | Iris | VRBO reviews |

## Performance Tables (Migration 004 — Phase 3)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_performance_snapshots` | Echo | Monthly snapshots |
| `signalos_owner_reports` | Echo | Owner report drafts |
| `signalos_agent_decisions_log` | All | Decision audit trail |
| `signalos_longterm_rental_benchmarks` | Reid | LTR comparison data |

## Content Tables (Migration 005 — Phase 4)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_content_decisions` | Sharon | Brand rulings |
| `signalos_content_performance` | Flint | Content analytics |

## Autonomy Tables (Migration 006 — Phase 5)

| Table | Owner | Purpose |
|-------|-------|---------|
| `signalos_confidence_patterns` | Jarvis | Pattern fingerprints |
