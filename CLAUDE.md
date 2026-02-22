# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Project Overview

**STR Revenue Manager Agent** — a Python CLI tool that automates pricing analysis
and recommendations for a portfolio of 180+ Short-Term Rental properties.

**Data flow:**
```
Resly (PMS) → Supabase (reservations table) → Python Agent → Google Sheet (recommendations)
```

Human operators review recommendations in Google Sheets and apply approved rate
changes manually in Resly. No automated write-back to Resly in the current MVP.

## Repository Structure

```
.
├── agent/
│   ├── analyzer.py      # Per-property occupancy, ADR, lead-time metrics
│   ├── main.py          # CLI entry point — orchestrates the full pipeline
│   ├── recommender.py   # Claude-powered pricing recommendations (batched)
│   └── sheets.py        # Google Sheets output writer
├── data/
│   └── supabase_client.py  # Supabase connection and reservations fetch
├── config.py            # All configuration loaded from environment variables
├── .env.example         # Template — copy to .env and fill in secrets
├── .gitignore
├── requirements.txt
└── README.md
```

## Development Branch

Active development occurs on branches prefixed with `claude/`.
Current working branch: `claude/add-claude-documentation-8hJLq`.

## Git Conventions

- Branch naming: `claude/<short-description>-<session-id>`
- Always push with: `git push -u origin <branch-name>`
- Write clear, descriptive commit messages summarising what changed and why
- Never push directly to `main` without explicit permission
- Never commit `.env` or `service_account.json` (both are git-ignored)

## Architecture Decisions

| Concern | Decision | Reason |
|---|---|---|
| Language | Python 3.11+ | Best ecosystem for data analysis + Anthropic SDK |
| LLM | Claude (`claude-opus-4-6`) via `anthropic` SDK | Intelligent reasoning over occupancy metrics |
| Database | Supabase (Postgres) | Existing Resly sync |
| Output | Google Sheets | Lightweight human-approval workflow for MVP |
| Automation level | Recommendations only | Human reviews and applies changes in Resly |
| Batch size | 20 properties per Claude call | Balances API cost and latency for 180+ properties |

## Key Configuration

All secrets and column name mappings live in `.env` (see `.env.example`).
Critical variables:
- `SUPABASE_URL`, `SUPABASE_KEY`, `RESERVATIONS_TABLE`
- `COL_*` — map canonical field names to actual Supabase column names
- `CONFIRMED_STATUSES` — comma-separated reservation statuses to include
- `ANTHROPIC_API_KEY`
- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_FILE`

## Running the Agent

```bash
# Install dependencies
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env  # then fill in values

# Inspect Supabase schema (useful on first run)
python -m agent.main --debug-schema

# Run full analysis
python -m agent.main
```

## Development Workflow for AI Assistants

1. Read this file first to understand project context.
2. Check `config.py` before touching any environment-dependent logic.
3. Run `python -m agent.main --debug-schema` to validate Supabase connectivity.
4. Follow existing code style: type hints, short functions, no over-engineering.
5. Do not commit secrets (`.env`, `service_account.json` are git-ignored).
6. Do not add features beyond what is currently requested.

## Key Conventions

- **No auto-write to Resly** — all changes require human approval via Google Sheets.
- **Column mapping** — Resly field names in Supabase may differ from canonical names; always use `COLUMN_MAP` from `config.py`.
- **Batch LLM calls** — never call Claude once per property; use the `BATCH_SIZE` batching in `recommender.py`.
- **Security first** — validate all external input at `data/supabase_client.py`; never expose raw errors to end users.
- **Ask before assuming** — if the Supabase schema or Resly field names are ambiguous, use `--debug-schema` or ask the owner before implementing.

## Contact / Repo Owner

Repository: `Danmoxxi/Test`
Remote: configured via local proxy
