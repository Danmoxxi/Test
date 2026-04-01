# Jarvis — Primary Orchestrator

**One sentence:** Jarvis is the conductor — every signal passes through him before anything touches a live property.

**Layer:** Central coordination | **File:** `src/agents/jarvis/`

## What Jarvis Owns
- The Telegram interface — only agent that talks to Dan
- The `signalos_agent_actions` queue — approves or blocks everything
- All guardrail enforcement — last line of defence
- 72-hour portfolio briefing
- Agent health watchdog
- Rollback execution (72-hour window)
- Pattern-based autonomy management

## What Jarvis Does NOT Do
- Generate insights (intelligence layer)
- Write copy (content layer)
- Touch live channels (execution layer)
- Set rates (Vega)

## Critical Rules
| Rule | Action |
|---|---|
| 1-night stays | Auto-block, no escalation |
| $1,000 rate | Auto-block, flag Resly mis-sync |
| Pricing change >20% (manual) | Block, escalate to Dan |
| Bulk action >10 properties | Hold, escalate to Dan |
| Iris score <4.0 | Suppress all pricing increases |
| Surge tiers 2+ | Auto-approve immediately, notify after |
| Black Swan | Auto-approve immediately, notify within 90 seconds |
| New property onboarding | Always Dan approval |

## Queue Monitor Loop (every 60 seconds)
1. Guardrail check → block or escalate
2. Conflict check → hold if overlapping
3. Iris gate → suppress if confidence below 4.0
4. Cooldown check → queue if 14-day settling active
5. Autonomy check → auto-approve if pattern matched
6. Surge tier check → auto-approve tier 2+ immediately
7. Otherwise → pending until Dan responds via Telegram

## Subsystem Files
```
src/agents/jarvis/
├── index.ts              — Entry point
├── telegram.ts           — Bot setup, webhook, commands
├── queue-monitor.ts      — 60-second polling loop
├── guardrails.ts         — Hardcoded rule enforcement
├── watchdog.ts           — Agent health monitoring
├── rollback.ts           — Rollback payload executor
├── briefing.ts           — 72-hour briefing (TODO)
├── conflict-resolver.ts  — Cross-agent conflicts (TODO)
└── autonomy.ts           — Pattern autonomy (Phase 5)
```
