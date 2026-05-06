# Status

**Last updated:** 2026-05-06

## Phase

Catalog hygiene pass: every tool now carries MCP `annotations`
(readOnlyHint / destructiveHint / idempotentHint / openWorldHint)
so clients can filter, safety-prompt, and reason about retry
behavior without parsing prose. Sparse read-tool descriptions
(list/get/lookup/calendar/health/diskspace + Prowlarr reads) got
rewritten with disambiguation hints + cross-references. **92 tools
live on the NAS deploy** out of **120 in code** (Sonarr 29,
Radarr 27, Lidarr 30, Prowlarr 6, Readarr 28). Readarr's tools
ship in code but don't register on this deploy because Readarr is
disabled (Goodreads upstream). Code-complete
catalogue: cross-app observability (health/diskspace), add-media
prerequisites (list_quality_profiles, list_root_folders, list_tags,
list_metadata_profiles for Lidarr/Readarr), wanted/missing +
wanted/cutoff queries, full command-trigger surface (16 tools) +
`<app>_get_command` poll companion, add-media for the four media
apps, `<app>_queue_remove` + `<app>_queue_regrab` for the four
media apps, `<app>_history_mark_failed` for the four media apps,
`<app>_edit_<resource>` for the four media apps,
`<app>_release_search` for the four media apps,
`<app>_grab_release` for the four media apps (Radarr + Sonarr
verified end-to-end; Lidarr untested — see Known Gaps),
single-resource drill-downs (`sonarr_get_episode`,
`lidarr_get_album`, `lidarr_get_track`, `readarr_get_book`), and
`prowlarr_indexer_status` for actionable per-indexer failure
detail. Per-resource sibling files: `queue.ts`, `history.ts`,
`wanted.ts`, `commands.ts`, `releases.ts`, plus the existing
`series.ts`/`movies.ts`/`artists.ts`/`authors.ts`. Same-host
hostname trap fixed early (`extra_hosts:
host.docker.internal:host-gateway` in compose, env URLs use
`http://host.docker.internal:<port>`). Deploy git-managed
Portainer stack id 148.

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

## Done (write tools — command-trigger complete)

All three command-trigger batches shipped and smoke-tested
end-to-end against the live deploy. All sixteen tools returned real
CommandResources from the *arr apps; every command-name spelling +
arg shape per the per-app docs was correct on first try.

| Tool | Command | Args |
| --- | --- | --- |
| `sonarr_search_missing` | `MissingEpisodeSearch` | — |
| `radarr_search_missing` | `MissingMoviesSearch` | — |
| `lidarr_search_missing` | `MissingAlbumSearch` | — |
| `readarr_search_missing` | `MissingBookSearch` | — |
| `sonarr_refresh_series` | `RefreshSeries` | `{seriesId}` |
| `radarr_refresh_movie` | `RefreshMovie` | `{movieIds: [...]}` |
| `lidarr_refresh_artist` | `RefreshArtist` | `{artistId}` |
| `readarr_refresh_author` | `RefreshAuthor` | `{authorId}` |
| `sonarr_search_series` | `SeriesSearch` | `{seriesId}` |
| `sonarr_search_season` | `SeasonSearch` | `{seriesId, seasonNumber}` |
| `sonarr_search_episode` | `EpisodeSearch` | `{episodeIds: [...]}` |
| `radarr_search_movie` | `MoviesSearch` | `{movieIds: [...]}` |
| `lidarr_search_artist` | `ArtistSearch` | `{artistId}` |
| `lidarr_search_album` | `AlbumSearch` | `{albumIds: [...]}` |
| `readarr_search_author` | `AuthorSearch` | `{authorId}` |
| `readarr_search_book` | `BookSearch` | `{bookIds: [...]}` |

Pattern confirmed: parent resources (series/artist/author) take a
single id; leaf resources (episode/movie/album/book) take an array.

Live tool count: **70** (54 read + 16 command-trigger write).

## Done (write tools — add-media, four apps)

Same lookup-merge-POST pattern across all four media apps:

| Tool | Foreign id | Lookup prefix | addOptions key | Monitor enum | Smoke-test |
| --- | --- | --- | --- | --- | --- |
| `sonarr_add_series` | `tvdb_id` (int) | `tvdb:<id>` | `searchForMissingEpisodes` | yes | ✅ `SeriesExistsValidator` 400 |
| `radarr_add_movie` | `tmdb_id` (int) | `tmdb:<id>` | `searchForMovie` | no | ✅ `MovieExistsValidator` 400 |
| `lidarr_add_artist` | `foreign_artist_id` (MBID UUID) | `lidarr:<mbid>` | `searchForMissingAlbums` | yes | ✅ `ArtistExistsValidator` 400 |
| `readarr_add_author` | `foreign_author_id` (Goodreads id) | `readarr:<id>` (best guess) | `searchForMissingBooks` | yes | ⚠️ blocked — see below |

Lidarr/Readarr also need `metadataProfileId` (Sonarr/Radarr don't —
Sonarr uses language profiles, Radarr nests language inside quality
profiles). Shipped `<app>_list_metadata_profiles` read tools for
Lidarr + Readarr; method on `ServarrClient` base alongside
`qualityProfiles()`.

Per-app sibling files: `tools/sonarr/series.ts`,
`tools/radarr/movies.ts`, `tools/lidarr/artists.ts`,
`tools/readarr/authors.ts`. Each exports a
`register<Resource>Tools(server, client)` called from the app's
`index.ts`.

Safe defaults are uniform: `monitored=true`, search-on-add `false`
(flips the unsafe server-side default of `true` for all four).

Live tool count with all four media apps + Prowlarr enabled: **76**
(46 read + 16 command-trigger + 2 list-metadata-profiles + 4 add-media,
across 5 apps). With Readarr currently disabled (see below), the
running deploy advertises **58 tools** across Sonarr, Radarr, Lidarr,
Prowlarr.

## Readarr disabled until upstream metadata source is operational

`readarr_lookup_author` (existing read tool) and `readarr_add_author`
(new) both depend on Readarr's `/author/lookup` endpoint, which
queries Goodreads upstream. **Goodreads' public API has been
deprecated; Readarr returns 503 with
`NzbDrone.Core.MetadataSource.Goodreads.GoodreadsException` for any
lookup query — by name OR by foreign id.** Well-known *arr
community issue, not a bug in our code.

Decision: **dropped Readarr from the deploy entirely** by removing
`READARR_URL` and `READARR_API_KEY` from the Portainer stack env
(via `portainer_set_stack_env --remove`). Per CLAUDE.md, missing env
vars → tools simply aren't registered. Cleaner than leaving 18
readarr_* tools registered where most either need lookup (broken)
or query Readarr's local DB (works, but the LLM has no way to add
new authors so library would only shrink).

To re-enable when Readarr's metadata source is fixed (Goodreads back,
or Readarr migrates to OpenLibrary / a community fork): re-add the
two env vars in Portainer. The code is still in `src/clients/readarr.ts`
+ `src/tools/readarr/`; the `readarr_add_author` tool is structurally
identical to the three verified ones and should work once upstream
is operational.

## Done (write tools — queue manipulation)

Two write tools shipped on the queue resource family:

- **`<app>_queue_remove`** — `DELETE /queue/{id}` with all four
  cross-cutting flags surfaced explicitly (`remove_from_client`,
  `blocklist`, `skip_redownload`, `change_category`). All defaults
  flipped to `false` to neutralise Servarr's destructive
  `removeFromClient=true` server-side default. Smoke-tested with
  a non-existent id → 404 NotFound across Sonarr/Radarr/Lidarr.
- **`<app>_queue_regrab`** — `POST /queue/grab/{id}`. Low risk;
  forces a re-grab of a stuck queue item. Smoke-tested same way →
  404 NotFound across the three enabled apps.

Plumbing on `ServarrClient` base: `requestDelete(path, params)` for
the DELETE shape, `queueRemove(id, opts)` builds the four flags,
`queueRegrab(id)` is a thin wrapper over the existing `requestPost`.

The `<app>_queue` read tool migrated from `index.ts` into the new
per-app `tools/<app>/queue.ts` sibling alongside the two writes —
keeps the queue resource family in one place per the
per-resource splitting rule.

## Done (write tools — history_mark_failed)

- **`<app>_history_mark_failed`** — `POST /history/failed/{id}`.
  Tells the *arr the imported file was wrong, prompting a
  re-search on the next interval. Skipped for Prowlarr (no
  download history; it's a search proxy).
- New plumbing on `ServarrClient` base:
  - `requestPostVoid(path, body)` helper, symmetric with
    `requestDelete` — for POSTs that mutate state and return no
    body, so we don't try to parse empty JSON.
  - `markHistoryFailed(id)` method.
- New per-app `tools/<app>/history.ts` siblings holding the
  existing `<app>_history` (read) and the new write tool together.
- Smoke-tested with a non-existent history id (99999999) — Sonarr,
  Radarr, Lidarr each returned the expected `404 NotFound` with
  app-specific `ModelNotFoundException` messages
  (`EpisodeHistory` / `MovieHistory` / `EntityHistory`).
  Plumbing validated without touching real history.

## Done (write tools — edit-media)

All four media apps got their edit tool. Same GET → mutate → PUT
pattern across the board, since Servarr requires the full resource
body on PUT (sparse → 400 per docs).

| Tool | Editable fields |
| --- | --- |
| `sonarr_edit_series` | monitored, quality_profile_id, root_folder_path, season_folder, tags |
| `radarr_edit_movie` | monitored, quality_profile_id, root_folder_path, minimum_availability, tags |
| `lidarr_edit_artist` | monitored, quality_profile_id, metadata_profile_id, root_folder_path, tags |
| `readarr_edit_author` | monitored, quality_profile_id, metadata_profile_id, root_folder_path, tags |

All inputs except `id` are optional — the tool fetches the current
resource, applies only the fields the caller passed, and PUTs the
full body. `tags` is a full-list replacement (Servarr API doesn't
have append semantics). `root_folder_path` change moves files on
disk — flagged in every tool description.

Plumbing on `ServarrClient` base: new `requestPut<T>(path, body)`
helper. Per-app `edit<Resource>(id, body)` wraps it. Tools live in
the existing per-resource siblings (`series.ts`, `movies.ts`,
`artists.ts`, `authors.ts`) alongside their add tools.

Smoke-tested with the round-trip-without-changes pattern: pass just
the id, no other fields → tool merges nothing → PUT returns the
unchanged resource. Sonarr/Radarr/Lidarr all returned the original
title + monitored state intact. Readarr's ships but is disabled on
the deploy.

## Done (read tools — release search)

`<app>_release_search` shipped for Sonarr, Radarr, Lidarr, Readarr.
Hits `GET /release` with the per-app id filters: `seriesId` /
`episodeId` / `seasonNumber` (Sonarr), `movieId` (Radarr), `artistId`
/ `albumId` (Lidarr), `authorId` / `bookId` (Readarr). Returns
ReleaseResource[] candidates without grabbing — feeds the future
grab_release write tool.

The endpoint triggers a live indexer search server-side, so tools
warn it's slow + rate-limit-sensitive in their descriptions. At
least one scoping id is required at the tool layer (handler-level
guard, since a Zod-shape `inputSchema` doesn't expose `.refine()`)
to keep the LLM from issuing unscoped indexer searches.

Plumbing on `ServarrClient` base: new
`searchReleases(params: Record<string, number | undefined>)` that
filters out undefined values before forwarding to `/release`. Each
app's tool registration lives in a new
`src/tools/<app>/releases.ts` sibling — pre-staged for the
grab_release pair.

Smoke-tested against the deploy: Radarr returned 18 candidates for
"14 Blades" (movie_id=7899), Sonarr 198 for The Herculoids S1
(series_id=257, season_number=1), Lidarr 50 for Weird Al Yankovic
(artist_id=1). All returned full ReleaseResource shape with rejection
reasons populated (releases were rejected because user already has
preferred files on disk — expected behavior). Readarr's ships in
code but is disabled on the deploy.

## Done (catalog hygiene — annotations + description rewrites)

With 120 tools live, agents need structured signal beyond prose to
choose well. Two-part pass:

**MCP `annotations` everywhere.** Nine reusable bundles defined in
`ServarrClient` base, wired into all 120 `registerTool` calls:

| Bundle | When | Hints |
|--------|------|-------|
| `ANN_READ` | reads of *arr internal state | readOnly=true |
| `ANN_READ_EXT` | external metadata (TMDB/TVDB/MusicBrainz/Goodreads) or live indexer hits | readOnly=true, openWorld=true |
| `ANN_ADD` | `add_<resource>` | destructive=false, idempotent=false |
| `ANN_EDIT` | `edit_<resource>` | destructive=true (root-folder moves), idempotent=true |
| `ANN_COMMAND` | `search_*` / `refresh_*` triggers | idempotent=true (queue-level), openWorld=true |
| `ANN_GRAB` | `grab_release` | additive, idempotent=false (re-grab spawns dup), openWorld=true |
| `ANN_QUEUE_REMOVE` | `queue_remove` | destructive=true (can delete file), idempotent=true |
| `ANN_QUEUE_REGRAB` | `queue_regrab` | idempotent=false |
| `ANN_MARK_FAILED` | `history_mark_failed` | destructive=true (downstream re-grab/replace), idempotent=true |

**Description rewrites** on the previously-sparse read tools:
list/get/lookup/calendar/health/diskspace and Prowlarr's reads.
Each rewritten with "what / when to use / which related tools to
consider next" prose. Disambiguates list_X ↔ get_X ↔ lookup_X,
points health-summary tools to `prowlarr_indexer_status` for
actionable detail, and reinforces external-metadata vs
library-tracked distinction (`*_lookup_*` searches the upstream
catalogue, not your library).

Visibility caveat (consistent with the earlier progress-notification
note): Claude Code today doesn't expose annotations to the
user-visible UI directly, but they're spec-compliant metadata that
any annotation-aware client (or future Claude Code) will use for
filtering and safety prompts.

## Done (Tier 2 — quality-of-life)

Four small batches addressing real friction observed across this
session.

- **`<app>_queue` paged** for Sonarr/Radarr/Lidarr/Readarr — the
  existing tool gained optional `page` / `page_size` inputs
  (defaults: 1 / 20, max 100). No new tool — backward-compatible
  in-place enhancement. Earlier in the session a 15-record Radarr
  queue overflowed our context buffer; real queues hit 50+
  routinely. Plumbing on `ServarrClient.queue(page, pageSize)`.
- **Per-resource history** for Sonarr/Radarr/Lidarr/Readarr —
  `<app>_history_<resource>` (`history_series`, `history_movie`,
  `history_artist`, `history_author`). Sonarr's full history is
  ~250000 records on this deploy — server-wide queries are
  unusable for "what happened with X?" lookups. Smoke-tested with
  Princess Mononoke (movie 17603): returned 4 events showing the
  full grab → import → delete → re-grab upgrade path.
- **Radarr direct-id lookups** — `radarr_lookup_tmdb`,
  `radarr_lookup_imdb`. When the caller already has a TMDB id
  (e.g. from Plex) or an IMDB id ("tt0119698"), going through
  `radarr_lookup_movie`'s fuzzy term search wastes a round-trip
  and risks fuzzy mismatch. Smoke-tested with `tt0119698` —
  returned the full MovieResource for Princess Mononoke in one
  shot.
- **Lidarr trackfile listing** — `lidarr_list_trackfiles` with
  optional `artist_id` / `album_id` / `unmapped` filters.
  `unmapped=true` returns orphan files (on disk but not linked to
  any track) — composes with filesystem-mcp for "what's on disk
  that shouldn't be?" reconciliation queries. Lidarr-only per docs
  scope; Sonarr/Radarr/Readarr have equivalent
  `/episodefile`/`/moviefile`/`/bookfile` endpoints if/when needed.

## Done (Tier 1 — diagnostics + closure)

Four small batches shipped together to close gaps surfaced earlier
this session. Each is a thin wrapper over an existing endpoint;
patterns mirror the existing read-tool conventions.

- **`<app>_get_command`** for Sonarr/Radarr/Lidarr/Readarr — poll
  the CommandResource id returned by any `_search_missing` /
  `_refresh_*` / `_search_<resource>` trigger. Status field reports
  `queued | started | completed | failed`. Until now, there was no
  way to confirm a queued command had actually finished.
  Plumbing: new `getCommand(id)` on `ServarrClient` base.
- **`<app>_list_tags`** for Sonarr/Radarr/Lidarr/Readarr — `GET
  /tag` returns label+id pairs. Prerequisite for any future
  tag-scoped query or tag-setting add/edit. Plumbing: new `tags()`
  on `ServarrClient` base.
- **`prowlarr_indexer_status`** — `GET /indexerstatus` returns
  per-indexer failure detail (disabled-until, most-recent-failure
  timestamp, initial-failure timestamp). Companion to the
  summarizing `prowlarr_health`. Smoke-tested live: surfaced an
  indexer (id 20) that has been failing since 2025-12-27 — over
  4 months — that the user wasn't aware of.
- **Single-resource drill-downs**: `sonarr_get_episode`,
  `lidarr_get_album`, `lidarr_get_track`, `readarr_get_book`. One
  GET-by-id each; companions to the existing `_list_*` tools.

Smoke tests: `prowlarr_indexer_status` (returned 2 unhealthy
indexers with timestamps, including the 4-month-old dead one) and
`sonarr_list_tags` (returned 42 tags). The other 11 tools are
identical patterns to existing read tools and weren't individually
exercised.

## Done (UX — progress notifications during release_search)

The four `<app>_release_search` handlers now emit
`notifications/progress` every 20s while the upstream `GET /release`
is in flight. Messages are scoped to the search target ("Sonarr:
searching indexers for episode 154373… (40s elapsed)") so the user
can see what's still in progress.

New helper `withProgress(extra, mkMessage, intervalMs, fn)` in
`ServarrClient` base. Skips emission if the client didn't include a
`progressToken` in the request `_meta`. Generic over the
notification type so the SDK's strict `ServerNotification` union
flows through without coercion at the call site.

**Visibility caveat:** Claude Code (current shipping version)
does *not* surface MCP progress notifications to the agent or user
during a tool call. Verified by running radarr_release_search for
movie 17603 (≈30s wall time); no progress line appeared. The code
is spec-compliant — kept as latent capability for clients that do
surface them. Pairing with a hard timeout (still parked) would give
an actual user-visible "timed out" surface in this client.

## Done (write tools — grab release)

`<app>_grab_release` shipped for Sonarr, Radarr, Lidarr, Readarr.
Hits `POST /release` with the ReleaseResource passed back verbatim
from `release_search`. Servarr keys the lookup on guid+indexerId
from its in-memory release cache; cache TTL is short (a few minutes,
and is wiped on container restart), so a "release not found" error
typically means re-run release_search and try again.

Tool input shape: a `release` object with required guid + indexerId,
all other fields `.passthrough()`ed so the LLM can hand the object
back unchanged. Plus an optional `should_override` boolean that
sets shouldOverride=true on the body — the equivalent of Servarr's
UI "Override and Download" button, used to force-grab releases the
quality profile rejected.

Plumbing on `ServarrClient` base: new `grabRelease(body)` method.
Per-app tool registration lives alongside `release_search` in the
existing `releases.ts` siblings.

**Bug caught at smoke test time** (Radarr, then Sonarr): the search
returns ReleaseResource with destination IDs null and the actual
match in `mapped*Id` fields. POST fails with "Value can not be
null. (Parameter 'release.MovieId')" / `release.SeriesId` if those
aren't set on the body. Each handler now copies the relevant mapped
fields to their direct counterparts before posting, unless the
caller already set them explicitly:

| App | Copies |
| --- | --- |
| Radarr | `mappedMovieId → movieId` |
| Sonarr | `mappedSeriesId → seriesId`, `mappedEpisodeInfo[].id → episodeIds` |
| Lidarr / Readarr | (no mapped\* fields exist, untested) |

Smoke tests:
- **Radarr**: grabbed `[REVO-deanzel] Princess Mononoke [BD 1080p
  Hi10p Dual Audio FLAC]` for movie_id=17603 with
  `should_override=true` (existing Remux-1080p file scored
  higher). Radarr history showed `eventType=grabbed`,
  `releaseSource=InteractiveSearch`, handed off to SABnzbd.
- **Sonarr**: grabbed `Daredevil.Born.Again.S02E08.The.Southern.
  Cross.1080p.DSNP.WEB-DL.DDP5.1.Atmos.H.264-FLUX` for
  episode_id=154373 with `should_override=true` (existing file had
  equal cf_score 1700). Sonarr history showed `eventType=grabbed`,
  `releaseType=SingleEpisode`, `releaseSource=InteractiveSearch`,
  handed off to SABnzbd.

## Next

1. **Smoke-test `lidarr_grab_release` / `readarr_grab_release`** —
   confirm whether Lidarr's lack of mapped fields just works.
   Readarr's tool ships in code but the deploy disables Readarr,
   so its real test will wait until the Goodreads upstream is back.
2. **Add tests** once a real Servarr test target is set up (don't
   mock).
3. **Optional later additions**: `radarr_edit_collection`
   (collection-level monitoring, Radarr-specific),
   `lidarr_monitor_albums` / `readarr_monitor_books` (bulk monitor
   toggles), per-season/episode monitor tools for Sonarr.

## Open Decisions

- **HTTP timeout strategy for `ServarrClient.request*`** (parked
  2026-05-06). Currently no timeout; bare `fetch()`. Caught when a
  Sonarr release_search for High School DxD S1 hung 5+ minutes
  (likely a slow indexer). Endpoint SLAs vary widely — most reads
  are sub-second, but `release_search` legitimately takes 30-60s
  (live indexer hit). Pitched but not decided: two-tier default
  (30s everywhere, `searchReleases` opts into 120s via
  `AbortController` + per-call override). Revisit when timeouts
  bite again.

Decisions made during scaffolding:

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
- `lidarr_grab_release` / `readarr_grab_release` ship in code but
  haven't been verified end-to-end. Lidarr/Readarr have no `mapped*`
  fields in their ReleaseResource, so the Radarr/Sonarr-style fix
  doesn't apply directly — they may already work, or may need a
  different fix discovered at smoke-test time. Readarr's deploy is
  disabled until Goodreads is back.
- API paths and endpoint shapes were derived from training data and
  smoke-tested only against the configured apps so far. Less-exercised
  endpoints (calendar, history) may have surprises on first call.
- Prowlarr's `/queue` endpoint may not exist (Prowlarr is a proxy, not
  a download manager). The base class includes a `queue()` method but
  Prowlarr's tool registration intentionally skips a `prowlarr_queue`
  tool. If `prowlarr_history` proves unreliable too, drop history
  inheritance and let Prowlarr define only its own methods.
