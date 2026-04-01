# SignalOS Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM (Dan / Team)                      │
│                         ↕                                    │
│                      JARVIS                                  │
│              (Orchestrator + Guardrails)                      │
│                    ↕         ↕                               │
│    ┌───────────────┴─────────┴───────────────┐               │
│    │         signalos_agent_actions           │               │
│    │         (Central Action Queue)           │               │
│    └────┬──────┬──────┬──────┬──────┬────────┘               │
│         ↕      ↕      ↕      ↕      ↕                       │
│    ┌────────┐┌──────┐┌────┐┌────┐┌──────┐                   │
│    │ Atlas  ││ Vega ││Echo││Iris││ Flint│  ← Intelligence    │
│    └────────┘└──────┘└────┘└────┘└──────┘                    │
│         ↕      ↕                    ↕                        │
│    ┌────────┐┌──────┐┌────┐┌──────┐┌──────┐                 │
│    │ Roman  ││ Mara ││Luca││Penny ││Sharon│  ← Execution    │
│    └────────┘└──────┘└────┘└──────┘└──────┘                  │
│         ↕      ↕      ↕                                     │
│    ┌────────┐┌──────┐┌────┐                                  │
│    │ Airbnb ││BCOM  ││VRBO│  ← Live Channels                │
│    └────────┘└──────┘└────┘                                  │
│                                                              │
│    ┌──────────────────────────────────────────┐              │
│    │        Supabase (Moxxi_DB_V2)           │              │
│    │  reservations (RO) | properties (RO)     │              │
│    │  signalos_* tables (26 SignalOS tables)   │              │
│    └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Agent Communication

Agents NEVER communicate directly. All signals flow through `signalos_agent_actions`:

```
Agent detects signal → writes to signalos_agent_actions (status: pending)
  → Jarvis polls every 60s → guardrail check → approve/block
  → Execution agent reads approved actions → executes → confirms
  → Logged to signalos_daily_actions
```

## Data Flow

```
Resly PMS → Supabase (reservations table, read-only)
  → SignalOS agents read reservations
  → Intelligence agents analyse and recommend
  → Jarvis approves/blocks
  → Execution agents push to PriceLabs / channels
  → Results logged to signalos_* tables
```

## Security Boundaries

- Supabase: service role key only, never anon
- Secrets: Supabase Vault, not .env
- Telegram: webhook + chat/user whitelist
- Playwright: encrypted sessions, random delays
- Rates: sanity checks before every PriceLabs push
