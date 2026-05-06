# servarr-mcp

MCP server for the Servarr stack (Sonarr, Radarr, Lidarr, Readarr,
Prowlarr), packaged as a Docker container.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

See [STATUS.md](STATUS.md) for the active phase, what's done, and
what's next.

## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- Servarr REST APIs accessed directly via `fetch` (no third-party client)
- Docker multi-stage build (alpine, non-root user)

## Layout

- `src/index.ts` — MCP server entry / composition root. Computes which
  apps are enabled from env vars at startup, then decides transport
  (stdio vs HTTP) based on `MCP_PORT`. Per-session `McpServer`
  instances via the `createServer()` factory; client instances are
  computed once at startup.
- `src/clients/base.ts` — `ServarrClient` base class with shared HTTP
  plumbing (`X-Api-Key` auth, request helper, common endpoints:
  systemStatus, queue, history). Also exports the `asText()` helper.
- `src/clients/<app>.ts` — one file per app, holding only the
  `<App>Client` class (subclass of `ServarrClient` with app-specific
  resource methods). Today: `sonarr.ts`, `radarr.ts`, `lidarr.ts`,
  `readarr.ts`, `prowlarr.ts`.
- `src/tools/<app>/index.ts` — MCP tool registrations for that app.
  Each exports a `register<App>Tools(server, client)` function. Today
  each app's `index.ts` holds all of that app's registrations directly.
  As tool counts grow, pull resource groups into sibling files
  (`series.ts`, `wanted.ts`, etc.) — see "Per-resource splitting"
  below.
- `docs/SERVARR-API.md` — cross-cutting Servarr API reference (auth,
  paging, command pattern, errors).
- `docs/<app>.md` — per-app endpoint catalogue + tool decisions
  (current tools, candidate read/write tools, out-of-scope, gotchas).
- `docs/specs/<app>.json` — version-pinned OpenAPI spec snapshots.
- `Dockerfile` — multi-stage build (alpine, non-root)
- `docker-compose.yml` — Compose/Portainer deployment using HTTP transport
- `.githooks/pre-commit` — gitleaks + PII pattern scan

## Per-resource splitting

Each `src/tools/<app>/index.ts` starts as a single file holding all
of that app's tool registrations. Pull a resource group into its own
sibling file (`src/tools/<app>/<resource>.ts`) when **either**:

- That app's `index.ts` crosses ~150 lines.
- A resource group has 3+ tools that are clearly a unit (e.g. all the
  queue-related tools, all the wanted tools).

The receiving sibling file exports a `register<Resource>Tools` that
the app's `index.ts` calls. Use the per-app docs (`docs/<app>.md`) to
inform the resource boundaries — those docs already group endpoints
by resource family.

## Cross-app tools

When the first tool arrives that **orchestrates across multiple
clients** (e.g. "search Prowlarr and add the result to Sonarr or
Radarr depending on media type"), create `src/tools/cross/` and put
the orchestration tool there. It takes whatever clients it needs as
constructor parameters; the composition root in `src/index.ts` wires
them.

Don't pre-create `src/tools/cross/` before the first orchestration
tool exists.

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
- **OpenChronicle** — registered at *user scope* (available in every
  project) as an HTTP MCP at the canonical NAS instance:
  `http://carldog-nas:18000/mcp`. Same daemon serves REST
  (`/api/v1/*`) and MCP (`/mcp`) on one port. Project ID for this
  repo on the NAS instance is
  `da6af588-040d-4908-a4d2-376dd6d2d6a5` — use it with
  `POST /api/v1/memory` (project_id field) or via the MCP tools.

If you re-clone on another machine: re-add the user-scope MCP entry
with `claude mcp add --transport http -s user openchronicle
http://carldog-nas:18000/mcp`. Serena works automatically if it's
already user-scoped on that machine.
