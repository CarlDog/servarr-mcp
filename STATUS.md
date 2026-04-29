# Status

**Last updated:** 2026-04-29

## Phase

API research complete — pre-build scaffolding for the larger tool
surface. Deploy still live on the NAS at `http://carldog-nas:3002/mcp`
with the existing 7 read tools per app working. Up next: refactor
`src/` into `clients/` + `tools/<app>/<resource>/` to make room for
the catalogued tool surface, then layer in tools per the per-app docs.

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

## Done (API research)

- **OpenAPI specs snapshotted** for all five apps in `docs/specs/*.json`,
  pinned to the live deploy versions: Sonarr v4.0.17.2952, Radarr
  v6.1.1.10360, Lidarr v3.1.0.4875, Readarr v0.4.18.2805, Prowlarr
  v2.3.5.5327. `.gitattributes` locks them to LF so refreshes diff
  cleanly. Live `/swagger/v3/swagger.json` is disabled in shipping
  builds → spec source is the version-tagged GitHub repo.
- **`docs/SERVARR-API.md`** — cross-cutting reference: identical
  X-Api-Key/apikey security across all apps, the PagingResource shape,
  the lookup pattern, the async `command` trigger pattern, the ~30
  shared resources, the lack of any documented error schema, the
  cross-cutting `DELETE /queue/{id}` flag set, and the
  Swagger-disabled / container-DNS gotchas.
- **Per-app catalogues** (`docs/sonarr.md`, `radarr.md`, `lidarr.md`,
  `readarr.md`, `prowlarr.md`) — each documents the resource catalogue
  grouped by capability, currently-exposed tools, candidate read tools,
  candidate write tools (with risk class), out-of-scope items
  (destructive / bulk / server lifecycle / config writes), and
  app-specific gotchas. Total: ~1100 lines of catalogued surface
  across ~1070 operations.

## Next

1. **Refactor `src/` into `clients/` + `tools/<app>/<resource>/`** —
   feature-folder layout informed by the per-app docs. Each
   `register<App>Tools` becomes a fan-out across resource modules.
   Mechanical, no behaviour change.
2. **Wire up candidate read tools** (per per-app doc tables) — quick
   wins like `wanted_missing`, `health`, `diskspace`, `list_quality_profiles`,
   `list_root_folders`. These are prerequisites for any add-media write.
3. **Wire into Claude Desktop** and verify tool calls flow through
   end-to-end from the assistant.
4. **Layer in write tools** in the order the per-app docs indicate:
   start with command-trigger tools (low risk: search, refresh), then
   add-media, then queue manipulation, then release-grab.
5. **Add tests** once a real Servarr test target is set up (don't mock).

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

- No tests yet.
- API paths and endpoint shapes were derived from training data and
  smoke-tested only against the configured apps so far. Less-exercised
  endpoints (calendar, history) may have surprises on first call.
- Prowlarr's `/queue` endpoint may not exist (Prowlarr is a proxy, not
  a download manager). The base class includes a `queue()` method but
  Prowlarr's tool registration intentionally skips a `prowlarr_queue`
  tool. If `prowlarr_history` proves unreliable too, drop history
  inheritance and let Prowlarr define only its own methods.
