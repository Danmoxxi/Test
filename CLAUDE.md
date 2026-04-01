# CLAUDE.md
## Moxxi SignalOS — Project Memory File
### Read this file at the start of every session. Do not skip it.

---

## What This Project Is

You are building **Moxxi SignalOS** — a multi-agent revenue intelligence operating system for Moxxi Property, a Tasmanian short-term rental management company operating 186 properties across five regions. This is a production system that makes live pricing changes to real properties on real booking channels. Every decision you make has commercial consequences.

**The system is not a prototype. It is not an experiment. Treat it accordingly.**

---

## Who You Are Building For

- **Dan de Witte** — CTO and co-founder. Comfortable with code, not a full-time developer. Makes architectural decisions and reviews your work. Direct communication — if something is wrong, say so.
- **Lauren Heys** — CEO and co-founder. Non-technical. The system must never expose her to operational risk.
- **Property management team** — receive email alerts from Iris. Not technical. Alerts must be clear, actionable, jargon-free.
- **186 property owners** — their revenue is directly affected by this system.

---

## Before You Write Any Code

**Read the docs folder first. Always.**

```
/docs/architecture.md          — Read this first, every session
/docs/agents/[agent-name].md   — Read before implementing any agent
/docs/database/schema.md       — Read before touching any table
/docs/business-rules/          — Read before any pricing or guardrail logic
/docs/integrations/            — Read before any API integration
```

If a docs file does not exist yet, ask Dan before proceeding. Do not invent architecture.

---

## Project Structure

```
signulos/
├── CLAUDE.md
├── docs/
├── src/
│   ├── agents/          — One folder per agent
│   ├── core/            — Shared infrastructure
│   ├── integrations/    — External API clients
│   ├── database/        — Migrations and queries
│   ├── components/      — shadcn/ui dashboard components
│   ├── types/           — TypeScript type definitions
│   └── utils/           — Shared utilities
├── scripts/             — One-time setup and seed scripts
└── tests/               — Vitest tests
```

---

## Tech Stack — Non-Negotiable

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 20+ | |
| Language | TypeScript | Strict mode. No `any` types. Ever. |
| AI SDK | @anthropic-ai/sdk | Model: claude-sonnet-4-6 |
| Database | Supabase PostgreSQL | Project: sofxjevxwlfbsruitscr |
| ORM | @supabase/supabase-js | Service role only — never anon key |
| Browser automation | Playwright + Chromium | Roman, Mara, Luca, Iris, Reid |
| Scheduling | node-cron | Agent polling schedules |
| Telegram | grammy | Webhook mode — not polling |
| Email | Resend | PM team alerts from Iris |
| HTTP | Axios | External API calls |
| Validation | Zod | All inputs and API responses |
| Logging | Winston | Structured. Sanitised. Never credentials. |
| Queue | Bull + Redis | Agent action queue |
| Secrets | Supabase Vault | All API keys and credentials |
| Testing | Vitest | Required before moving phases |

---

## The Thirteen Agents

| Agent | Name | Layer | Primary responsibility |
|---|---|---|---|
| Orchestrator | **Jarvis** | Coordination | Telegram, approvals, watchdog |
| Events | **Atlas** | Intelligence | Regional event calendars, external signals |
| Pricing | **Vega** | Intelligence | Rate curve, velocity, surge engine |
| Performance | **Echo** | Intelligence | Monthly analysis, learning loop, owner reports |
| Strategy | **Flint** | Content | Campaign briefs, timing |
| Copywriter | **Penny** | Content | Captions, listing audits |
| Brand | **Sharon** | Content | Copy approval, brand voice |
| Reviews | **Iris** | Intelligence | Confidence scoring, sentiment |
| Airbnb | **Roman** | Execution | Adjacency rules, LOS discounts |
| Booking.com | **Mara** | Execution | Genius tiers, promotions |
| VRBO | **Luca** | Execution | Accrual discounts |
| Benchmark | **Reid** | Intelligence | realestate.com.au scraping |

---

## The Five Regions

```typescript
type Region = 'launceston' | 'northwest' | 'northeast' | 'east_coast' | 'hobart'
```

---

## Database Rules

- **SignalOS tables use `signalos_` prefix.**
- **Existing Moxxi tables are read-only:** `reservations`, `properties`
- **Service role only. Never anon key.**
- **Never delete from critical tables. Archive instead.**

---

## Hardcoded Business Rules — Never Override

- Minimum stay: 2 nights. Never 1.
- $1,000 rate = Resly mis-sync. Block immediately.
- Surge tiers 2+ auto-execute. Never wait for approval.
- Rollback window: 72 hours.
- Rate sanity: min $50, max historical × 10.
- Direct booking saving: 10%.
- Max stacked discount: 40%.

---

## Security Rules

- Secrets in Supabase Vault, not .env.
- .env holds only: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NODE_ENV.
- Never log credentials, rates, or owner financial data.
- Telegram: webhook mode, verify secret, whitelist chat/user IDs.
- Playwright sessions: AES-256-GCM encrypted at rest.
- Rate limits enforced before execution.

---

## Agent Communication Protocol

Agents never communicate directly. All signals pass through `signalos_agent_actions`.

```
Agent detects signal -> logs to signalos_agent_actions (pending)
  -> Jarvis reviews -> approves or blocks
  -> Execution agent reads approved -> acts -> confirms (executed)
  -> Logged to signalos_daily_actions
```

---

## Build Phase Order

```
Phase 1 — Foundation (CURRENT)
  Jarvis (core) + Echo (core) + foundation tables

Phase 2 — Intelligence
  Atlas + Vega (read-only) + Iris

Phase 3 — Execution
  Vega (write) + Roman + Mara + Luca + Reid

Phase 4 — Content
  Sharon -> Penny -> Flint

Phase 5 — Autonomy
  Pattern fingerprints + similarity scoring
```

**When in doubt, surface it. The system is too commercially important for silent assumptions.**
