# Status

**Last updated:** 2026-05-01

## Phase

Read-tool rollout largely complete for v1: cross-app observability
(`health`, `diskspace`), add-media prerequisites (`list_quality_profiles`,
`list_root_folders`), and the wanted/missing + wanted/cutoff queries
all shipped. The `wanted` resource group is the first per-resource
split — each media app's `tools/<app>/index.ts` now imports a sibling
`wanted.ts` per the CLAUDE.md splitting rule. API research catalogued
~1070 operations in `docs/SERVARR-API.md` + per-app docs. Deploy is
live on the NAS at `http://your-nas:3002/mcp`. Next: wire into
Claude Desktop, then start on write tools.

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

## Done (architecture scaffolding)

- **`src/` split into `clients/` + `tools/<app>/`.** Each `src/<app>.ts`
  (which combined client class + tool registrations) became
  `src/clients/<app>.ts` (class only) + `src/tools/<app>/index.ts`
  (registrations only). `src/base.ts` → `src/clients/base.ts`.
  Mechanical refactor, no behaviour change. typecheck + build + lint
  + format:check all green against the new layout.
- **CLAUDE.md updated** to reflect the new layout and to describe the
  per-resource splitting trigger (split a `tools/<app>/` directory
  into resource-named siblings when the index.ts crosses ~150 lines
  or a resource group has 3+ tools).
- **`.prettierignore`** excludes `docs/specs/*.json` so prettier
  doesn't reformat upstream OpenAPI snapshots (which would corrupt
  the refresh-diff invariant and break CI's format:check).

## Done (read tools — observability)

- **`<app>_health`** registered for Sonarr, Radarr, Lidarr, Readarr,
  Prowlarr — hits `GET /health`. Surfaces indexer-down, low-disk,
  proxy-unreachable warnings.
- **`<app>_diskspace`** registered for Sonarr, Radarr, Lidarr, Readarr
  — hits `GET /diskspace`. Skipped Prowlarr (no `/diskspace` endpoint
  per spec; Prowlarr is a proxy, not a download manager).
- Both endpoints are uniform across apps, so the methods live on
  `ServarrClient` base alongside `queue()` / `history()`. Per-app tool
  registrations are thin wrappers.

## Done (read tools — add-media prerequisites)

- **`<app>_list_quality_profiles`** registered for Sonarr, Radarr,
  Lidarr, Readarr — hits `GET /qualityprofile`. Output `id` is the
  required `qualityProfileId` input for any future add-media tool.
- **`<app>_list_root_folders`** registered for the same four apps —
  hits `GET /rootfolder`. Output `path` is the required
  `rootFolderPath` input for any future add-media tool.
- Skipped for Prowlarr (no library / no add-media flow).
- Endpoints are uniform across the four media apps, so the methods
  also live on `ServarrClient` base.

## Done (read tools — wanted)

- **`<app>_wanted_missing`** registered for Sonarr, Radarr, Lidarr,
  Readarr — hits `GET /wanted/missing`. Lists items that should be
  downloaded but aren't yet (episodes / movies / albums / books).
  Inputs: `page_size` (default 20), `monitored` (default true).
- **`<app>_wanted_cutoff`** for the same four apps — hits
  `GET /wanted/cutoff`. Lists items downloaded below cutoff quality
  (upgrade candidates).
- Skipped Prowlarr (no library, no wanted concept).
- Endpoints + paging params are uniform across the four apps so the
  methods live on `ServarrClient` base. Per-app sort defaults left to
  each Servarr API; no `sortKey` passed through. Include-* flags
  (`includeSeries`, `includeAuthor`, etc.) deliberately omitted from
  v1 — LLM can call `list_series`/etc. for parent metadata.

## Done (refactor — wanted resource split)

- Each media app's two `wanted_*` registrations moved out of
  `tools/<app>/index.ts` into a sibling `tools/<app>/wanted.ts`
  exporting `registerWantedTools(server, client)`. The app's
  `index.ts` imports and calls it after its other registrations.
- Brought line counts back under the CLAUDE.md ~150-line threshold:
  Sonarr 138 (was 183), Radarr 126 (was 171), Lidarr 130 (was 175),
  Readarr 131 (was 176). Each `wanted.ts` is ~57 lines.
- Pure refactor — no behaviour change. Same tools, same shapes,
  same handlers. typecheck + build green.

## Next

1. **Wire into Claude Desktop** and verify tool calls flow through
   end-to-end from the assistant.
2. **Layer in write tools** in the order the per-app docs indicate:
   start with command-trigger tools (low risk: search, refresh), then
   add-media, then queue manipulation, then release-grab.
3. **Add tests** once a real Servarr test target is set up (don't mock).

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
