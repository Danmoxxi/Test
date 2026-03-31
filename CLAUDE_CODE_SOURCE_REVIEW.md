# Claude Code Source Code Review

**Repository reviewed:** `sanbuphy/claude-code-source-code`
**Version:** 2.1.88 (decompiled source for research)
**Date:** 2026-03-31

---

## 1. Project Overview

Claude Code is Anthropic's official CLI tool for AI-assisted software engineering. It is a
**TypeScript application** built on **React (Ink)** for terminal UI rendering, bundled with
**Bun** for performance, and structured as a rich agentic system that orchestrates Claude
API calls with local tool execution.

The decompiled source reveals ~1,940 files across `src/`, `tools/`, `utils/`, `vendor/`,
and supporting directories.

---

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     CLI Entry Point                      │
│  src/main.tsx  →  Commander.js (arg parsing)             │
│              →  init.ts (bootstrap)                      │
│              →  replLauncher.tsx (interactive REPL)       │
├─────────────────────────────────────────────────────────┤
│                     Core Loop                            │
│  QueryEngine.ts  — orchestrates conversation turns       │
│  query.ts        — single API call + tool execution loop │
│  Tool.ts         — tool type system & registry           │
├─────────────────────────────────────────────────────────┤
│                     State Management                     │
│  state/AppState.tsx  — React Context + external store    │
│  state/store.ts      — pub/sub state store               │
│  state/AppStateStore.ts — type definitions               │
├─────────────────────────────────────────────────────────┤
│                     Tools (40+)                           │
│  tools/BashTool      — shell command execution           │
│  tools/FileEditTool  — surgical file edits               │
│  tools/FileReadTool  — file reading                      │
│  tools/FileWriteTool — file writing                      │
│  tools/GlobTool      — file pattern matching             │
│  tools/GrepTool      — content search (ripgrep)          │
│  tools/AgentTool     — sub-agent spawning                │
│  tools/SkillTool     — slash command / skill execution   │
│  tools/WebSearchTool — web search                        │
│  tools/WebFetchTool  — URL fetching                      │
│  tools/MCPTool       — MCP server tool proxy             │
│  tools/TodoWriteTool — task tracking                     │
│  + 28 more tools...                                      │
├─────────────────────────────────────────────────────────┤
│                     Services                             │
│  services/api/       — Claude API client, retries, auth  │
│  services/mcp/       — MCP server connections            │
│  services/compact/   — context compaction                │
│  services/analytics/ — telemetry (GrowthBook gating)     │
│  services/oauth/     — OAuth flow                        │
│  services/plugins/   — plugin system                     │
│  services/lsp/       — LSP integration                   │
├─────────────────────────────────────────────────────────┤
│                     UI Layer (Ink/React)                  │
│  screens/            — REPL screens, dialogs             │
│  components/         — reusable terminal components      │
│  ink/                — custom Ink renderer patches        │
│  keybindings/        — keyboard shortcut system          │
│  vim/                — vim mode support                   │
├─────────────────────────────────────────────────────────┤
│                     Infrastructure                       │
│  hooks/              — React hooks (~85 hooks)           │
│  utils/              — shared utilities                   │
│  constants/          — prompts, config, limits           │
│  types/              — TypeScript type definitions        │
│  skills/             — bundled skill definitions          │
│  commands/           — slash commands (~90 commands)      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Components

### 3.1 Entry Point & Bootstrap (`src/main.tsx`)

The main entry point uses **Commander.js** for CLI argument parsing. Startup is
heavily optimized with parallel prefetching:

- **MDM settings** read (macOS/Windows policy)
- **Keychain prefetch** for OAuth/API keys
- **GrowthBook** feature flag initialization
- **MCP server** URL prefetch
- **Policy limits** loading

The bootstrap sequence in `entrypoints/init.ts` handles trust dialogs, analytics,
and environment configuration before launching either the interactive REPL or a
headless/SDK mode.

### 3.2 Query Engine (`src/QueryEngine.ts`)

The `QueryEngine` is the core orchestrator. It manages:

- **Conversation state** — messages array, system prompts, context attachments
- **Turn execution** — delegates to `query()` for each API call
- **Auto-compaction** — triggers context compression when token limits approach
- **File history snapshots** — tracks file states for rewind capability
- **Tool result budgeting** — manages output size limits
- **SDK event emission** — streams events for SDK consumers

### 3.3 Query Loop (`src/query.ts`)

The inner query loop (`query()`) handles a single conversation turn:

1. **Build system prompt** from parts (environment, user context, system context)
2. **Call Claude API** via `services/api/claude.ts`
3. **Process response** — handle text, tool_use blocks, thinking blocks
4. **Execute tools** via `StreamingToolExecutor` and `runTools()`
5. **Handle continuations** — max_output_tokens recovery, auto-continue
6. **Token budget tracking** — enforce per-turn and task-level budgets
7. **Post-sampling hooks** — execute user-defined hooks after each response

Key design: thinking blocks are carefully managed per Anthropic API rules
(preserved within assistant trajectories, stripped at boundaries).

### 3.4 Tool System (`src/Tool.ts`, `src/tools.ts`)

Tools are defined as typed objects implementing a standard interface:

```typescript
type Tool = {
  name: string
  description: string
  inputSchema: ToolInputJSONSchema
  async call(input, context): ToolResult
  validateInput?(input): ValidationResult
  isReadOnly?(): boolean
  // ... permission hooks, UI rendering, etc.
}
```

The `tools.ts` registry assembles the full tool pool. Key features:

- **Feature-gated tools** — `bun:bundle` feature flags enable dead code elimination
  for internal-only tools (REPL, Sleep, Monitor, etc.)
- **Ant-only tools** — `USER_TYPE === 'ant'` gates Anthropic-internal tools
- **Dynamic tool assembly** — MCP tools, plugin tools, and built-in tools are
  merged at runtime
- **Tool search / deferral** — `ToolSearchTool` enables lazy tool schema loading
  to reduce prompt size

### 3.5 Agent / Sub-agent System (`src/tools/AgentTool/`)

The Agent tool spawns sub-agents with their own conversation loops:

- **Built-in agents**: `general-purpose`, `Explore`, `Plan`, etc.
- **Custom agents**: user-defined agents from `.claude/agents/` directories
- **Isolation modes**: `worktree` creates a git worktree for safe parallel work
- **Background execution**: agents can run asynchronously with notification on completion
- **Fork sub-agents**: experimental feature for process-level isolation
- **Tool filtering**: sub-agents have restricted tool access (e.g., no nested agents)

Agent results flow back as tool results in the parent conversation.

### 3.6 Permissions & Security

Multi-layered permission system:

- **Permission modes**: configurable (e.g., `plan`, `auto-edit`, `full-auto`)
- **Per-tool permissions**: each tool declares its permission requirements
- **Bash security**: `bashSecurity.ts` + `bashPermissions.ts` analyze commands
  for destructive operations, path validation, sed edit detection
- **Sandbox mode**: `SandboxManager` provides OS-level sandboxing for shell commands
- **Read-only validation**: prevents write operations in restricted contexts
- **Policy limits**: server-side policy enforcement via `services/policyLimits/`
- **Denial tracking**: tracks user denials to adjust behavior

### 3.7 State Management (`src/state/`)

Uses a custom **pub/sub store** pattern (not Redux):

```typescript
createStore(initialState, onChange?) → { getState, setState, subscribe }
```

Wrapped in React context via `AppStateProvider`. Components subscribe to
state slices via `useAppState(selector)` with `useSyncExternalStore` for
tear-free reads.

### 3.8 Slash Commands (`src/commands/`, `src/commands.ts`)

~90 slash commands registered via a unified command registry. Notable commands:

| Command | Purpose |
|---------|---------|
| `/commit` | Git commit with AI message |
| `/compact` | Manually trigger context compaction |
| `/config` | View/edit settings |
| `/cost` | Show token usage and costs |
| `/diff` | Show file changes |
| `/doctor` | Diagnose installation issues |
| `/help` | Help information |
| `/init` | Initialize CLAUDE.md |
| `/mcp` | Manage MCP servers |
| `/plan` | Enter plan mode |
| `/review` | Code review |
| `/vim` | Toggle vim mode |

### 3.9 MCP Integration (`src/services/mcp/`)

First-class **Model Context Protocol** support:

- MCP server lifecycle management (connect, reconnect, health checks)
- Tool proxy — MCP server tools appear as native Claude Code tools
- Resource listing and reading
- Official MCP registry with prefetching
- Server approval UI for security
- VS Code SDK MCP bridge

### 3.10 Skills System (`src/skills/`)

Skills are higher-level capabilities beyond simple tools:

- Bundled skills defined in `skills/bundled/`
- Skill tool (`SkillTool`) executes skills as tool calls
- Skill search and indexing for discovery
- Skill change detection for hot reloading

### 3.11 Hooks System (`src/hooks/`)

~85 React hooks power the interactive REPL:

- **Input handling**: vim mode, arrow key history, paste, clipboard
- **IDE integration**: VS Code, JetBrains connection and sync
- **Session management**: backgrounding, resume, teleport
- **UI state**: terminal size, blink, elapsed time, virtual scroll
- **Feature hooks**: voice, diff, PR status, suggestions

### 3.12 Context & Memory

- **CLAUDE.md files**: loaded from project, user, and additional directories
- **Memory files**: `memdir/` manages persistent memory across sessions
- **Session storage**: conversation transcripts persisted to disk
- **File state cache**: tracks file modification times for change detection
- **Relevant memory prefetch**: proactively loads relevant context

---

## 4. Notable Implementation Patterns

### 4.1 Dead Code Elimination via Feature Flags

Extensive use of `bun:bundle` feature flags:

```typescript
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

This enables tree-shaking of internal-only features in the public build.
Features include: `KAIROS`, `PROACTIVE`, `BRIDGE_MODE`, `VOICE_MODE`,
`COORDINATOR_MODE`, `DAEMON`, `FORK_SUBAGENT`, `BUDDY`, `ULTRAPLAN`, etc.

### 4.2 Lazy Requires for Circular Dependency Breaking

```typescript
const getTeammateUtils = () =>
  require('./utils/teammate.js') as typeof import('./utils/teammate.js')
```

Frequently used to break import cycles in the large codebase.

### 4.3 Startup Performance Optimization

- Parallel prefetching of keychain, MDM, GrowthBook, MCP URLs
- Startup profiler (`utils/startupProfiler.js`) tracks checkpoint timing
- Early input capture to avoid losing keystrokes during initialization
- Module-level side effects marked with explicit lint-disable comments

### 4.4 React Compiler Output

Some components show React Compiler output patterns (e.g., `_c()` memoization
cache, `Symbol.for("react.memo_cache_sentinel")`), suggesting the codebase
uses the React Compiler for automatic memoization.

### 4.5 Streaming Tool Execution

`StreamingToolExecutor` in `services/tools/` enables tool execution to begin
while the API response is still streaming, reducing latency for multi-tool
responses.

### 4.6 Context Compaction

Multiple compaction strategies:
- **Auto-compact**: triggered when token count approaches limits
- **Reactive compact**: responds to prompt-too-long errors
- **Snip compact**: feature-gated history snipping
- **Context collapse**: feature-gated context folding
- **Manual compact**: via `/compact` command

### 4.7 Token Budget System

Dual budget system:
- **Task budget**: API-level `output_config.task_budget` for agentic turns
- **Token budget**: client-side auto-continue when output hits max_output_tokens
  (up to +500k continuation)

---

## 5. Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript |
| Runtime | Bun (bundler + feature flags) |
| UI Framework | React + Ink (terminal rendering) |
| CLI Parsing | Commander.js (`@commander-js/extra-typings`) |
| API Client | `@anthropic-ai/sdk` |
| MCP Client | `@modelcontextprotocol/sdk` |
| Validation | Zod v4 |
| Analytics | GrowthBook (feature flags + analytics) |
| Search | ripgrep (via GrepTool) |
| Auth | OAuth 2.0 + keychain storage |
| State | Custom pub/sub store + React context |

---

## 6. File Statistics

| Category | Count |
|----------|-------|
| Total files | ~1,940 |
| Source directories under `src/` | 35 |
| Tools | 40+ |
| Slash commands | ~90 |
| React hooks | ~85 |
| Services | 15+ |
| Feature flags | 15+ |

---

## 7. Key Observations

1. **Massive scope**: Claude Code is a full-featured IDE-class tool with voice,
   vim mode, MCP, plugins, multi-agent orchestration, and IDE integration.

2. **Performance-conscious**: Startup optimization with parallel prefetching,
   streaming tool execution, lazy requires, and dead code elimination.

3. **Security-first**: Multi-layered permission system, sandbox execution,
   command analysis, path validation, and policy enforcement.

4. **Extensible**: Plugin system, MCP integration, custom agents, skills,
   and hooks provide multiple extension points.

5. **Internal vs external builds**: Feature flags clearly separate Anthropic-internal
   features (KAIROS assistant mode, VOICE_MODE, COORDINATOR_MODE, etc.)
   from the public release.

6. **React-based TUI**: Unusual choice of React (Ink) for a CLI tool, but enables
   complex stateful UIs with the React component model and hooks ecosystem.

7. **Decompiled source**: This is reverse-engineered from a bundled build —
   some patterns (React Compiler output, mangled names) reflect the build
   process rather than original source style.
