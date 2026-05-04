# Status

**Last updated:** 2026-05-01

## Phase

Write-tool rollout in flight. First write tool batch shipped and
**verified end-to-end against the live deploy**: all four
`<app>_search_missing` tools succeeded (Sonarr, Radarr, Lidarr,
Readarr each returned a real CommandResource with id, status, and
the correct command name — no spelling fixes needed). Plumbing in
place: `triggerCommand(name, args)` on `ServarrClient` base via a
new `requestPost` helper. Each media app has a `tools/<app>/commands.ts`
sibling (preemptive split — more command-trigger tools coming).
Same-host hostname trap discovered + fixed: `docker-compose.yml` now
ships `extra_hosts: ["host.docker.internal:host-gateway"]` and the
NAS deploy's Portainer stack env was switched to
`http://host.docker.internal:<port>` — without it the container
can't resolve the bare host hostname and every tool call returns
"fetch failed" silently. Deploy live at `http://carldog-nas:3002/mcp`,
git-managed Portainer stack id 148.

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

## Done (CI fix — line endings)

- Three of my src/ files committed with CRLF on Windows; CI's
  `prettier --check` (with `endOfLine: "lf"`) failed on Linux. Fixed
  by running `prettier --write src/` to normalize, and locked
  `*.{ts,js,mjs,cjs,json,md,yml,yaml}` to LF in `.gitattributes` so
  future Windows commits can't drift again. Test + Publish workflows
  green from `8aed22a` onward.

## Done (deploy verified)

- Portainer stack id 148 redeployed with `pull_image=true` via
  `redeploy_git_stack`. ConfigHash advanced to `8aed22a`. Image
  pulled, container recreated; `org.opencontainers.image.revision`
  label = `2a66d8b` (the commit with all 25 new tools).
- `/health` returns 200 with all 5 apps enabled.
- MCP `tools/list` advertises **54 tools** total — 29 pre-existing +
  25 new (5× `health`, 4× `diskspace`, 4× `list_quality_profiles`,
  4× `list_root_folders`, 4× `wanted_missing`, 4× `wanted_cutoff`).
- Verified with direct MCP wire call against
  `http://carldog-nas:3002/mcp`, not just orchestrator UI.

## Done (write tools — search_missing)

- New `triggerCommand(name, args)` method on `ServarrClient` base —
  POSTs to `/command` with the body `{name, ...args}`, returns the
  queued CommandResource immediately. Backed by a new
  `requestPost<T>(path, body)` helper (parallel to the existing
  `request` GET helper).
- New `tools/<app>/commands.ts` sibling for the four media apps,
  exporting `registerCommandTools(server, client)`. Each app's
  `index.ts` imports and calls it after the wanted registrations.
- First registered tool per app: `<app>_search_missing` — triggers
  an indexer search across all monitored, missing items. Async; tool
  description spells out the queued nature so the LLM doesn't expect
  search results inline. Command names used:
  - Sonarr → `MissingEpisodeSearch`
  - Radarr → `MissingMoviesSearch`
  - Lidarr → `MissingAlbumSearch`
  - Readarr → `MissingBookSearch`
- Skipped Prowlarr — its existing `prowlarr_search` is the
  synchronous `GET /search`; no async equivalent in the command
  pattern.
- Smoke-test against the live deploy after this lands — per-app
  docs flagged the command names as "verify by source/test call" so
  any 400s here mean the spelling needs adjustment.

## Done (deploy fix — same-host hostname trap)

- `docker-compose.yml` (commit `0f24d23`) now maps
  `host.docker.internal:host-gateway` via `extra_hosts`, so
  containers on the same host as the *arr apps can resolve the host
  via that alias regardless of OS (Linux Docker too — not just
  Docker Desktop).
- README updated with the same-host guidance.
- NAS deploy's Portainer stack-level env switched from
  `http://carldog-nas:<port>` to `http://host.docker.internal:<port>`
  for all five `<APP>_URL` vars via `portainer_set_stack_env`. (API
  keys preserved via the noRedact server-side round-trip.)
- Verified ground truth via `docker inspect` —
  `HostConfig.ExtraHosts` and `Config.Env` both correct on the
  running container.
- **Note for future:** calling `redeploy_git_stack` immediately
  after `set_stack_env` rolled the env back to its previous values.
  The standalone `set_stack_env` redeploy worked. Prefer
  `set_stack_env` (which triggers its own redeploy) over chaining
  `redeploy_git_stack` afterward.

## Done (write tools — smoke-test)

- All four `<app>_search_missing` calls returned real
  CommandResources from the live deploy:
  - Sonarr → `name: "MissingEpisodeSearch"`, status started
  - Radarr → `name: "MissingMoviesSearch"`, status queued
  - Lidarr → `name: "MissingAlbumSearch"`, status started
  - Readarr → `name: "MissingBookSearch"`, status started
- Per-app docs' command-name spellings were all correct on first
  try; the "verify by source/test call" caveats can be removed in a
  doc-tightening pass.

## Next

1. **`<app>_refresh_<resource>`** in `commands.ts` —
   `RefreshSeries` / `RefreshMovie` / `RefreshArtist` /
   `RefreshAuthor`. Single-resource by id input.
2. **`<app>_search_<resource>` with id args** —
   `SeriesSearch`/`SeasonSearch`/`EpisodeSearch` for Sonarr,
   `MoviesSearch` for Radarr, `ArtistSearch`/`AlbumSearch` for
   Lidarr, `AuthorSearch`/`BookSearch` for Readarr.
3. **Add-media write tools** (`<app>_add_<resource>`) — uses
   `qualityProfileId` + `rootFolderPath` already shipped as read
   tools. Higher risk; will need careful input validation.
4. **Add tests** once a real Servarr test target is set up (don't
   mock).
5. **Doc tidy** — drop the "verify exact name" caveats from per-app
   doc tables for the command names confirmed in this session
   (`MissingEpisodeSearch`, `MissingMoviesSearch`,
   `MissingAlbumSearch`, `MissingBookSearch`).

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
