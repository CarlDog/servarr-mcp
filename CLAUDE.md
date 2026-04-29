# servarr-mcp

MCP server for the Servarr stack (Sonarr, Radarr, Lidarr, Readarr,
Prowlarr), packaged as a Docker container.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

**Phase: scaffolding** — see [STATUS.md](STATUS.md) for the active
phase, what's done, and what's next.

## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- Servarr REST APIs accessed directly via `fetch` (no third-party client)
- Docker multi-stage build (alpine, non-root user)

## Layout

- `src/index.ts` — MCP server entry. Computes which apps are enabled
  from env vars at startup, then decides transport (stdio vs HTTP)
  based on `MCP_PORT`. Per-session `McpServer` instances via the
  `createServer()` factory; client instances are computed once at startup.
- `src/base.ts` — `ServarrClient` base class with shared HTTP plumbing
  (`X-Api-Key` auth, request helper, common endpoints: systemStatus,
  queue, history). Also exports `asText()` helper.
- `src/sonarr.ts`, `radarr.ts`, `lidarr.ts`, `readarr.ts`, `prowlarr.ts` —
  one file per app: subclass of `ServarrClient` with app-specific
  resource methods, plus a `register<App>Tools(server, client)` function
  that registers MCP tools for that app.
- `Dockerfile` — multi-stage build (alpine, non-root)
- `docker-compose.yml` — Compose/Portainer deployment using HTTP transport
- `.githooks/pre-commit` — gitleaks scan

## When to add a `tools/` layer

Today each integration's API client and its MCP tool registrations live
in the same file (`src/<app>.ts` holds both `<App>Client` and
`register<App>Tools`). That's idiomatic when each tool is a thin
wrapper over a single API call.

**Trigger to refactor:** the first tool that doesn't fit cleanly in any
existing app file. Concretely:

- A tool that **orchestrates across multiple clients** — e.g. search
  Prowlarr and add the result to Sonarr or Radarr depending on type,
  or "promote a series upgrade" that touches Sonarr quality profiles
  and Prowlarr indexer routing.
- A tool that does **non-trivial composition** of multiple upstream
  calls — cross-references, ranking, filtering beyond what any single
  API exposes natively.

When that moment arrives:

1. Create `src/tools/<descriptive-name>.ts` for the cross-cutting tool.
2. Pull existing per-app `register<App>Tools` functions into
   `src/tools/<app>.ts` for symmetry. Each `src/<app>.ts` then holds
   just the client class.
3. Mechanical refactor, ~30 min for the current 5-app surface.

Don't pre-split before that trigger. Three similar lines is better than
a premature abstraction — and the right split shape is easier to see
once the first orchestration tool exists than before.

## Transport modes

The same image supports two transports, selected at start time:

- **stdio (default)** — used when `MCP_PORT` is unset. Server reads
  MCP wire from stdin and writes to stdout. Standard mode for
  `docker run -i` invocation by an MCP client.
- **HTTP (Streamable HTTP)** — used when `MCP_PORT` is set to a port
  number. Server listens on `0.0.0.0:$MCP_PORT` with two endpoints:
  - `POST/GET/DELETE /mcp` — MCP Streamable HTTP per spec; per-session
    `mcp-session-id` header. Clients initialize via `POST /mcp` (no
    session header) which mints a UUID; subsequent requests reuse it.
  - `GET /health` — liveness probe (used by docker healthcheck).
    Includes the list of enabled apps for visibility.

  Per-session `McpServer` instances via the `createServer()` factory;
  the enabled-apps list is computed once at startup from env vars.

The two modes are mutually exclusive in a given process.

## API paths

Servarr-team apps split into two API versions:

- **v3:** Sonarr, Radarr → `/api/v3/...`
- **v1:** Lidarr, Readarr, Prowlarr → `/api/v1/...`

Subclasses set their `apiPath` in their constructor. Don't put it in
the base — Lidarr v2 (when it eventually ships) will need to override it.

## Common Commands

```bash
npm install            # install deps
npm run build          # tsc → dist/
npm run dev            # tsx src/index.ts (requires at least one app's env vars)
npm run typecheck      # tsc --noEmit
docker build -t servarr-mcp .
```

## Conventions

- All logging goes to **stderr** (`console.error`). stdout is the MCP
  wire protocol — writing to it corrupts the transport.
- Tool names: `<app>_<verb_noun>` (e.g. `sonarr_list_series`,
  `prowlarr_indexer_stats`). Always snake_case.
- Tool inputs validated with `zod`. Outputs returned as a single
  JSON-stringified text content block via the `asText()` helper.
- Apps are **optional**. Missing env vars → tools simply aren't registered.
  No errors, no warnings — the server silently scopes to whatever's set.

## Testing

No tests yet. When added, integration tests against a real Servarr
instance behind env-gated tests (don't mock the Servarr APIs — see
working-style note about mocked-vs-real divergence).

## MCP tooling (local workstation)

This repo is registered with two MCP servers for Claude Code sessions
opened in this directory:

- **Serena** — user-scoped (available in every project on this machine).
  Project memories are written under the `servarr-mcp` Serena project.
  Re-onboarding isn't needed; if memories drift, update them with
  `mcp__serena__write_memory`.
- **OpenChronicle** — registered at *local scope* for this directory
  via `claude mcp add openchronicle -- oc mcp serve`. Effective for
  future Claude Code sessions opened with cwd = repo root. Config lives
  in `~/.claude.json` under the project entry — not committed.

If you re-clone the repo on another machine, re-register OpenChronicle
with the same command. Serena will work automatically if it's already
user-scoped on that machine.
