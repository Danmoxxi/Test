# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Project Overview

This repository is intended for a **Revenue Manager Agent** for a Short-Term Rental (STR) business. The agent will automate dynamic pricing, occupancy optimization, and revenue analytics for STR properties.

## Repository Status

This is a freshly initialized repository. No source code, framework, or language has been committed yet. All architectural and tooling decisions should be made in collaboration with the repository owner before implementation begins.

## Development Branch

Active development occurs on branches prefixed with `claude/`. The current working branch is `claude/add-claude-documentation-8hJLq`.

## Git Conventions

- Branch naming: `claude/<short-description>-<session-id>`
- Always push with: `git push -u origin <branch-name>`
- Write clear, descriptive commit messages summarizing what changed and why
- Never push directly to `main` without explicit permission

## Intended Architecture (TBD)

Once the project is initialized, this section should document:

- **Language & runtime** (e.g., Python 3.11+, Node.js 20+)
- **Framework** (e.g., FastAPI, Express, LangChain, etc.)
- **AI/LLM integration** (e.g., Anthropic Claude API via `anthropic` SDK)
- **Data sources** (e.g., Airbnb API, VRBO, PriceLabs, AirDNA, internal PMS)
- **Infrastructure** (e.g., Docker, cloud provider, database)

## Development Workflow

Once project files exist:

1. Read this file first to understand project context
2. Check for `README.md`, `package.json`, `pyproject.toml`, or `Makefile` for build/run commands
3. Run tests before and after making changes
4. Follow existing code style and conventions in the project

## Key Conventions for AI Assistants

- **Do not over-engineer**: Add only what is needed for the current task
- **Do not create files unnecessarily**: Prefer editing existing files
- **Do not commit secrets**: Never commit API keys, tokens, or credentials
- **Security first**: Validate all external input; never expose internal errors to clients
- **Ask before assuming**: If requirements are ambiguous, ask before implementing

## Contact / Repo Owner

Repository: `Danmoxxi/Test`
Remote: configured via local proxy
