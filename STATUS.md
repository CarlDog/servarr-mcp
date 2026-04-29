# Status

**Last updated:** 2026-04-28

## Phase

HTTP transport added (matching the plex-mcp pilot). Same image now
supports stdio and Streamable HTTP, selected by the `MCP_PORT` env var.
`docker-compose.yml` added for Portainer/Compose deployment. Pending
live smoke test of HTTP path against real Servarr instances.

## Done

- Repo initialized with TypeScript + MCP SDK + base ServarrClient skeleton
- Five app clients with read-only tools registered:
  - **Sonarr** (TV) — list/get/lookup series, list episodes, calendar, queue, history
  - **Radarr** (movies) — list/get/lookup movies, calendar, queue, history
  - **Lidarr** (music) — list/get/lookup artists, list albums, queue, history
  - **Readarr** (books) — list/get/lookup authors, list books, queue, history
  - **Prowlarr** (indexer manager) — list indexers, indexer stats, search, history
- Apps are optional via env vars (`<APP>_URL`, `<APP>_API_KEY`). Missing
  → tools simply not registered. At least one app must be configured or
  the server exits with a clear error.
- Multi-stage Dockerfile (alpine, non-root user `servarr`)
- Security baseline: `.gitignore`, `.gitleaks.toml`, `.githooks/pre-commit`
- Project docs: CLAUDE.md, STATUS.md, README.md

## Done (post-scaffold)

- `npm install` + `tsc` clean. SDK and zod resolved cleanly; all 7 dist
  outputs produced. 0 vulnerabilities.
- Public repo published at https://github.com/CarlDog/servarr-mcp with
  a no-PII commit author (CarlDog noreply).
- Serena project activated; five memories written
  (`project_overview`, `structure`, `suggested_commands`, `conventions`,
  `task_completion`). `.serena/` committed.
- OpenChronicle MCP server registered local-scope for this directory
  (`claude mcp add openchronicle -- oc mcp serve`).
- **Dual transport:** stdio (default) + Streamable HTTP (when `MCP_PORT`
  set). Per-session `McpServer` factory; `/mcp` endpoint with session-id
  header; `/health` for docker healthcheck (reports enabled apps).
  Express dependency added.
- **Compose deploy:** `docker-compose.yml` with HTTP transport on port
  `${HOST_PORT:-3002}:3000`, env passthrough for all `<APP>_*` vars,
  healthcheck via wget. Pulls `ghcr.io/carldog/servarr-mcp:latest`.

## Next

- Smoke-test the HTTP transport: deploy via Portainer (Stack from Git
  pointing at this repo) or `docker compose up` against real Servarr
  instances. Hit `/mcp` with the MCP Inspector or curl, verify a tool
  roundtrip per configured app.
- Smoke-test stdio path still works post-refactor: `docker run -i --rm
  -e SONARR_URL=... -e SONARR_API_KEY=... servarr-mcp`.
- Wire into Claude Desktop config (HTTP via `"url": "http://nas:3002/mcp"`
  or stdio via `docker run -i`) and verify tool calls flow through.

## Open Decisions

None active. Decisions made during scaffolding:

- **Phase 1 scope:** Sonarr, Radarr, Lidarr, Readarr, Prowlarr — Servarr
  team apps that share the v1/v3 API style. Whisparr skipped pending
  user need; Bazarr and Mylar3 deferred to Phase 2 (separate API
  surfaces, separate clients required).
- **Read-only first:** no write operations (no add/remove movies, no
  trigger search, no blocklist). Smoke-test reads first, then layer in
  writes once the read path is proven.
- **One MCP, one container:** all apps in one server process. Apps are
  optional via env vars; configure whichever you actually run.
- **Inheritance over composition:** each app subclasses `ServarrClient`.
  Shared methods (queue, history, systemStatus) live in the base. App-
  specific resource methods (series, movies, artists, indexers) live in
  the subclass. Tradeoff: two-level hierarchy is the simplest thing that
  works for 5 apps. If a 6th app diverges sharply, revisit composition.
- **API paths in subclass:** Sonarr/Radarr → `/api/v3`, others → `/api/v1`.
  Set in each subclass constructor so future version bumps are local.
- **No Plex client SDK:** raw `fetch`. Same reasoning as plex-mcp —
  small surface, fewer transitive deps, the Servarr REST API is
  straightforward.

## Known Gaps

- No tests yet
- No CI yet
- No published Docker image yet
- API paths and endpoint shapes match my training-data knowledge but
  haven't been smoke-tested against live instances. Most likely to
  shift: query parameter names on calendar/history endpoints, response
  shape for `/queue`. Verify on first connection.
- Prowlarr's `/queue` endpoint may not exist (Prowlarr is a proxy, not
  a download manager). The base class includes a `queue()` method but
  Prowlarr's tool registration intentionally skips a `prowlarr_queue`
  tool. If `prowlarr_history` proves unreliable too, drop history
  inheritance and let Prowlarr define only its own methods.
