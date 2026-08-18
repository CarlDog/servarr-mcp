# Status

**Last updated:** 2026-08-18

## Phase

**2026-08-18 — transport failures now surface their real cause
(MCP-F08).** `ServarrClient.requestOnce()`'s network-error catch built its
message from `(err as Error).message` only — on a real `fetch()` failure
that's Node's generic `TypeError: fetch failed`, discarding the actual
DNS/connection/TLS reason in `error.cause`. Found via a same-day fleet-wide
sweep prompted by an equivalent live incident in downloader-mcp (a stale
upstream URL stayed silently broken because every failure just said "fetch
failed"). Fixed at the source: the canonical `src/shared/errors.ts` gained
`describeTransportError()` (new fleet standard MCP-F08), copied in here
verbatim and wired into `base.ts`'s catch block. Verified: typecheck, build,
test:unit (74/74), lint, format:check all clean.

**Fixed a spec violation that made the MCP look disconnected.** Reported as
"servarr-mcp isn't connected"; the server was healthy the whole time. The
30-minute idle sweep had evicted the client's session (correct, deliberate),
but the next request carrying that now-unknown session id got **HTTP 400**.
The Streamable HTTP spec (2025-06-18, Session Management §3/§4) makes **404**
the client's *only* defined signal to re-initialize, so a routine eviction
read as a dead connection. Fixed in the fleet-canonical
`src/shared/http-transport.ts` and propagated to all six servers that carry
the same code (`atlascloud-mcp`, `plex-companion`, `kindroid-mcp` share the
file; `plex-mcp` and `downloader-mcp` hand-roll it). New
`src/shared/http-transport.test.ts` (8 tests) locks it in — verified to fail
against the pre-fix code. Also added `MCP_SESSION_IDLE_MS` to
`docker-compose.yml`: the code always read it, but it was missing from the
`environment:` block, so it read as configurable and silently wasn't
(`docker-deployments.md` §10).

Closed the loop on accumulated `mcp-feedback` dogfooding notes (real
usage sessions from 2026-08-11 and 2026-08-12) — three fixes, all
verified and pushed:

- **Security: Prowlarr API key leak via history `downloadUrl`,
  fixed.** Confirmed independently on `sonarr_history` (22
  occurrences/100 records) and `radarr_history_movie` (2/2 records —
  the *recommended narrow drill-down tool*, meaning there was no
  low-exposure way to read history at all). The `asText()` redaction
  chokepoint now strips `apikey`/`api_key`/`passkey`/`pass_key` query
  params from every string in the response tree, not scoped to any
  field name — covers the confirmed case plus `nzbInfoUrl`/`guid`/
  `infoUrl` and anything future. 12 new tests.
- **`path` + `move_files` added to all four edit tools.** A real
  165-item metadata-only path correction (case/mount-alias fix, zero
  bytes meant to move) had no safe route through the MCP —
  `root_folder_path` was the only settable path field, and changing it
  makes Servarr compute a relocation. Forced a raw-HTTP-API fallback
  with manually-extracted credentials, which is how the leaked key
  above ended up cached on disk in the first place. `path` now sets
  the on-disk folder string directly; `move_files` is always passed
  explicitly to the upstream PUT (default false) rather than relying
  on Servarr's own default. Verified via the pinned OpenAPI specs that
  all four resource schemas and PUT endpoints support this uniformly.
  6 new tests.
- **`MCP_AUTH_TOKEN` set on the live deploy.** Had shipped in code
  back on 2026-07-30 (MCP-F03) but was never actually set in the
  Portainer stack env — the `/mcp` endpoint had been accepting
  unauthenticated write-capable requests for a week. Verified this
  workstation's Claude Code config was the only consumer before
  flipping it on; updated that config with the bearer token in the
  same pass so nothing broke. Verified live: unauthenticated POST
  `/mcp` now 401s, a request with the token 200s, `/health` stays open
  as designed.

Still open from the same dogfooding notes (not touched this round):
bulk queue removal (a 54-item incident needed 54 separate calls), no
import-list/notification tools (health checks diagnose but can't
fix), no manual-import tool (a blocked queue item is a diagnosis-only
dead end), root-folder tools don't surface item-level path mismatches,
and list endpoints lack field projection with inconsistent page-size
caps across siblings. Full detail in the OpenChronicle project's
`mcp-feedback` memories (tagged `partially-resolved`).

**102 tests** (62 unit / 40 integration), all green; typecheck/lint/
format/build all clean.

## Phase (previous — dependency majors + build fix)

Security hardening across the outbound and inbound edges, plus two new
tools. The HTTP transport now requires bearer auth, a Host/Origin
allowlist, and idle-session eviction — previously reachable
unauthenticated on the network despite being write-capable (add/edit/
grab/remove across four media apps). Sensitive `Field` values
(Prowlarr API keys/passkeys/RSS keys) are now redacted recursively
before reaching the model, at any nesting depth. Every outbound *arr
request now has a 30s timeout, throws a typed `ApiError`, and retries
GET-only on 429 with bounded jittered backoff — resolves the HTTP
timeout Open Decision parked since 2026-05-06 (see caveat under Done
below: it shipped as one flat timeout, not the two-tier split
originally pitched). `radarr_quick_add_movie` / `sonarr_quick_add_series`
collapse the lookup-then-add two-step into one fuzzy-matched call.
Also landed: MIT license, a gitleaks CI backstop, Docker publish gated
on tests passing, and least-privilege CodeQL permissions — partial
progress against the open fleet standards-gap tracker (issue #9),
which still lists ~9 adoption-debt items (canonical `shared/` file
layout — now partially adopted via the security work above —
container HEALTHCHECK, `.editorconfig`, etc.) not yet started, and
whose three P0 findings (MCP-F03, MCP-P04, MCP-F01/F02/F04) are now
resolved by the work below but not yet checked off on the issue
itself.

**Test count correction:** the "128 unit tests" figure above was
wrong when first written this session — see "Done — fix dist/test
contamination" below. The real, verified count is **6 unit test
files / 44 tests**, **10 files / 84 tests** total including the
read-only integration suite. All green; typecheck/lint/format/build
all clean. Also landed: `express` 4→5, `zod` 3→4, `@types/express`
4→5, `@types/node` 22→26 (typecheck/lint/build/full-test-suite clean,
plus a live HTTP-transport smoke test — server boot, `/health`,
a real MCP `initialize` handshake, and `tools/list` across all 122
tools including the one using `.passthrough()`). `typescript` bumped
5.9.3 → 6.0.3 — the highest version compatible with `typescript-eslint`,
which caps at `<6.1.0` (see "Done — dependency updates" below); the
7.0.2 the original Dependabot PR wanted is still blocked.

## Phase (previous — test infrastructure)

Test infrastructure rounded out: 19 unit tests + 40 read-only
integration tests against the real *arr instances, gated on env
vars so CI silently skips integration when creds aren't present.
Unit tests cover the bug-prone paths (grab_release mapped-id
fix-up, release_search guards, withProgress lifecycle, annotation-
coverage walk that catches future drift). Integration tests cover
the public read methods on each ServarrClient: health, diskspace,
list/get/lookup, paged queue+history, wanted, profile listings,
prowlarr indexer status. CI matrix (ubuntu/windows/macos × node
22) green throughout. Locally: 59 tests in ~5s.

Catalog hygiene: every tool carries MCP `annotations`
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
  `http://your-nas:3002/mcp`, not just orchestrator UI.

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
  `http://your-nas:<port>` to `http://host.docker.internal:<port>`
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

## Done (test infrastructure — integration tests)

40 read-only integration tests across Sonarr / Radarr / Lidarr /
Prowlarr added on top of the unit suite. Each suite gates on its
app's `URL` + `API_KEY` env vars via `describe.skipIf`; CI doesn't
ship `.env` so the suites silently skip there. Locally,
`vitest.config.ts` loads `.env` before tests run so existing creds
Just Work.

Coverage targets the public read methods: `health`, `diskspace`,
`list_<resource>`, `lookup_<resource>` (anchored to known upstream
ids — Princess Mononoke tmdbId=128 / imdbId=tt0119698 — to verify
end-to-end shape), paged `queue` / `history`, `wantedMissing`,
`qualityProfiles`, `metadataProfiles` (Lidarr), `rootFolders`,
`tags`, and `prowlarr_indexer_status`.

Excluded from this batch (deferred):
- All write ops (`add_*` / `edit_*` / `grab_release` /
  `queue_remove` / `history_mark_failed`) — would mutate the real
  production library
- `release_search` / `prowlarr_search` — slow, indexer-rate-limit-
  sensitive; opt-in fixture pattern lands later
- Readarr — disabled on the deploy until Goodreads is back

New scripts: `npm run test:unit` (excludes integration) and
`npm run test:integration` (just the integration files). Default
`npm run test` still runs everything; integration suites
auto-skip without creds.

Local run total: 59 tests (19 unit + 40 integration), ~5s.

## Done (test infrastructure — unit suite)

Vitest stood up as the unit test framework. **19 tests across 5
files**, ~450ms locally, wired into the existing CI matrix
(ubuntu / windows / macos × node 22).

Coverage targets the bug-prone paths:
- `asText` output shape and `withProgress` lifecycle
  (skip-when-no-token, emit-on-timer, cleanup-on-rejection).
- All 120 registered tools must carry MCP `annotations` consistent
  with their category — `readOnlyHint` for reads, `destructiveHint`
  for queue_remove / mark_failed / edit_*, `openWorldHint` for
  external-fanout. Catches future drift where a new tool ships
  without hints.
- `grab_release` mapped-fix-up logic: Radarr `mappedMovieId →
  movieId` and Sonarr `mappedSeriesId → seriesId`,
  `mappedEpisodeInfo[].id → episodeIds`. Exact bugs we caught
  smoke-testing Princess Mononoke and Daredevil S02E08.
- `release_search` "at least one id" handler-level guard for
  Sonarr / Lidarr / Readarr (Radarr's tool has the constraint at
  the schema layer).

Test helpers in `src/tools/_test_utils.ts`:
- `CaptureServer` shadows `McpServer.registerTool` to capture
  `(name, config, callback)` tuples; tests then invoke callbacks
  directly with stubbed clients.
- `fakeExtra()` builds a minimal `RequestHandlerExtra`-shaped
  object for handler invocation outside an MCP request.

CI install command: `npm install --prefer-offline --no-audit
--no-fund` rather than `npm ci`. The Windows-generated lockfile
omits Linux/macOS-specific optional binary peers
(`@rollup/rollup-*` pulls in platform-specific `@emnapi/*` peers
that `npm ci` insists on). `npm install` resolves those at install
time gracefully.

**Integration tests against a real Servarr instance deferred to a
follow-up.** Per working-style, those should hit a real instance
(no API mocking) — needs more thought on safe credential handling
in dev / opt-in env-gated execution.

## Done (catalog hygiene — cross-reference audit)

Wired up the implicit workflow graph across the catalog so an LLM
choosing a tool can see which other tools feed it / are fed by it.
Targeted, surgical updates only — left descriptions that already
referenced their composition partners alone.

| Direction | Tools updated | What was added |
| --- | --- | --- |
| trigger → poll | 17 (`search_*` + `refresh_*`) | "Poll status with `<app>_get_command`" |
| server-wide → scoped + action | 4 (`<app>_history`) | points at per-resource version (`history_series`/`history_movie`/`history_artist`/`history_author`) and `<app>_history_mark_failed` |
| inventory → action | 8 (`wanted_missing` + `wanted_cutoff`) | points at `<app>_search_missing` for the indexer hunt |
| input → source | 4 (`history_mark_failed` id field) | per-resource history tool now listed alongside server-wide |
| edit input → list | 8 fields across 4 edit tools | `root_folder_path` → `list_root_folders`, `tags` → `list_tags` |

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

## Done (size — slim+paged list tools)

`radarr_list_movies` returned a tool result that exceeded the 1 MB
MCP cap on the user's library (~2000+ movies). Radarr's `/movie`
endpoint takes only `tmdbId` / `excludeLocalCovers` / `languageId`
— no upstream paging or filters — so server-side projection +
slicing is the only fix. Same shape applies to Sonarr's `/series`,
Lidarr's `/artist`, and Lidarr's `/album` (the last with the
recursive ArtistResource ↔ AlbumResource embedding).

Four `_list_*` tools rewritten to:

- Default to a slim per-item projection (id + a small set of
  user-relevant fields; full list per tool in
  `src/tools/<app>/index.ts`). `statistics` (small rollup) kept on
  series/artist/album because it carries `sizeOnDisk` + completion
  counts.
- Accept optional `page` (default 1), `page_size` (default 50,
  max 200) and return the standard
  `{page, page_size, total_records, records}` shape.
- Accept optional `verbose: true` for the full upstream resource —
  escape hatch; drill-down `*_get_*` tools are still the preferred
  path for one item's full shape.

New shared helper `src/tools/_paging.ts` (`paginate`, `pickFields`)
with 7 unit tests in `_paging.test.ts` covering past-end, MAX page
size, missing fields, and falsy preservation. Total test count:
**66** (was 59).

Breaking change: the four tools now return a paged object instead
of a bare array. Tool descriptions spell that out. Integration
tests unaffected — they assert on `client.list*()` methods, which
return the unmodified upstream shape.

## Done (build infra — Dockerfile + publish workflow)

Trying to redeploy the slim+paged tools surfaced two latent
problems in the build pipeline. The Test workflow had been fixed
in `25a9da0` to handle the Windows-generated lockfile (which
omits Linux-only `@rollup/rollup-*` and `@emnapi/*` peers because
those binaries don't install on Windows), but the same fix never
made it to the Dockerfile or the publish workflow. First publish
that hit it was `a3d6335` yesterday (docs-only) — failed silently;
no one noticed until today.

- **Dockerfile** (`149d92b`): switched `RUN npm ci` →
  `RUN npm install --prefer-offline --no-audit --no-fund`. Same
  command CI uses. Comment in the Dockerfile explains why.
- **Publish workflow** (`f1199af`): dropped `linux/arm64` from
  `platforms`. With `npm install` resolving peers via network,
  arm64 via QEMU emulation hangs indefinitely (the run sat at
  1h+ in 'Build and push' before being cancelled). amd64 native
  builds in ~80s. Re-add arm64 when the lockfile is regenerated
  cross-platform and we can revert the Dockerfile to `npm ci`.

Deploy verified live on Portainer stack 148, ConfigHash advanced
to `f1199af`. `docker inspect` confirmed
`org.opencontainers.image.revision = f1199af...`, image created
2026-05-08T22:11:35Z, healthcheck `healthy` returning the four
enabled apps (Sonarr, Radarr, Lidarr, Prowlarr — Readarr still
deploy-disabled), and `host.docker.internal:host-gateway` still
mapped. `radarr_list_movies` returned a paged result over a 2283-
movie library — the regression is gone.

- **Dev-chain eslint 10 + SDK 1.30 audit sweep (2026-07-29).** eslint
  ^10.8.0, @eslint/js ^10.0.1, eslint-config-prettier ^10.1.8;
  @modelcontextprotocol/sdk ^1.30.0 with @hono/node-server 2.0.12
  (GHSA-frvp-7c67-39w9 path-traversal moderate). npm audit 0, was 5
  high + 2 moderate. Lockfile written with pinned npm 10.9.8 (fleet
  npm-version-skew lesson). Verified: lint, typecheck, 134/134 tests.
  Runtime majors (express/undici/zod/TS) stay deferred per the closed
  npm-major PR.

## Done (security hardening — HTTP transport auth, host allowlist, idle eviction)

MCP-F03 (`aa70cf1`, 2026-07-30). The Streamable-HTTP transport was
unhardened on all four counts a standards audit flagged: no auth
check on `/mcp`, no Host/Origin allowlist (DNS-rebinding exposed —
binding loopback means nothing inside a container, per
`docker-deployments.md` §8), no idle-session eviction (a long-lived
NAS container accumulates every `McpServer` ever created since
clients disconnect without a clean teardown far more often than they
send one), and no shutdown handling. This is a write-capable server
reachable unauthenticated on the network.

Adopted the fleet-canonical `src/shared/http-transport.ts` verbatim
(standard MCP-F03/MCP-S01, hash-compared — don't hand-edit) plus its
two direct dependencies, `src/shared/log.ts` and `src/shared/redact.ts`,
rather than hand-rolling an equivalent. New optional env vars, both
defaulting to open with a loud startup warning either way so the
posture is never silent: `MCP_AUTH_TOKEN` (bearer, SHA-256-hashed
constant-time comparison), `MCP_ALLOWED_HOSTS` (comma-separated Host/
Origin allowlist), `MCP_SESSION_IDLE_MS` (default 30 minutes). SIGTERM/
SIGINT now wired to the transport's `dispose()`. Bind address stays
`0.0.0.0` deliberately — the allowlist is the real defense, not the
bind address.

Verified against the running server (not just unit tests of the
canonical file): 401 on missing/wrong bearer token, 403 on a
disallowed Host with the expected log line, a real session
initializing when both checks pass, `/health` reachable without auth
(outside the `/mcp` mount), the documented open-with-warnings default
when neither var is set, clean exit under SIGTERM.

## Done (security hardening — sensitive field redaction)

MCP-P04 (`fc9c1e5`, 2026-07-30). `asText()` is the one chokepoint
every tool response passes through, but nothing there redacted
anything — concretely, `prowlarr_list_indexers` returned each
indexer's raw apiKey/passkey/RSS key verbatim. Prowlarr's own OpenAPI
spec (`docs/specs/prowlarr.json`) marks exactly these values with a
`privacy` discriminator on `Field` objects (`normal | password |
apiKey | userName`); nothing checked it.

`asText` now recursively walks the response tree and redacts any
object matching Servarr's Field shape (`{value, privacy: <non-normal>}`)
at any nesting depth, regardless of which tool/app it came from —
covers any current or future tool returning Field-shaped data
(download clients, notifications, and import lists use the same
schema), not just the already-identified Prowlarr case. 5 new tests:
the concrete Prowlarr-shaped case, each of the three sensitive privacy
levels, a negative case (`privacy: normal` untouched), a negative case
(value without a privacy discriminator untouched — don't over-redact),
and arbitrary nesting depth.

## Done (security hardening — outbound timeout, typed errors, bounded retry)

MCP-F01/F02/F04 (`39ed91d`, 2026-08-05). `ServarrClient`'s HTTP
methods threw plain `Error` with no timeout and no retry. Adopted the
fleet-canonical `src/shared/errors.ts` verbatim (`ApiError`,
`formatApiError`, `parseRetryAfterMs`, `backoffMs`, `shouldRetry`) and
funneled every request method through one `requestOnce` chokepoint
that arms an `AbortController` per attempt and throws a typed
`ApiError` carrying `status`/`retryAfterMs`/`body`. Added a bounded
exponential-backoff retry loop for GET only (`MAX_RETRIES = 3`,
jittered); POST/PUT/DELETE stay single-attempt since their effect on
failure is ambiguous. `Retry-After` is honored but capped at
`MAX_RETRY_AFTER_MS = 60_000` — an upstream asking to wait longer than
that throws rather than stalling the whole tool queue.

**Resolves the HTTP timeout Open Decision parked since 2026-05-06 —
with a caveat.** It shipped as a single flat 30s timeout everywhere,
not the two-tier 30s/120s split the Open Decision had pitched for
`searchReleases`'s slower live-indexer path. A legitimately slow
30-60s `release_search` (the case that originally motivated the
decision — a High School DxD S1 search hung 5+ minutes on a slow
indexer) can now abort at 30s instead of hanging indefinitely, which
is strictly better than before, but a per-call timeout override for
`searchReleases` is still worth revisiting if 30s proves too tight in
practice.

## Done (write tools — quick-add)

`radarr_quick_add_movie` / `sonarr_quick_add_series` (`8785282`,
2026-08-05) collapse the lookup-then-add two-step into one
fuzzy-matched call for the common unambiguous case, mirroring a
pattern found in atlascloud-mcp during a comparative fleet review.

Design decisions confirmed with the operator before writing code:
`quality_profile_id`/`root_folder_path` auto-resolve only when exactly
one is configured; with more than one, the tool refuses and lists the
options rather than guessing. `search_for_movie`/
`search_for_missing_episodes` default to `false`, matching the
existing `radarr_add_movie`/`sonarr_add_series` tools. An ambiguous
title match also refuses and lists candidates rather than picking one.
Verified via unit tests only (`CaptureServer` + monkey-patched client
methods) — no live write against production, per this repo's policy
of no write-integration-tests against production. 10 new tests. (The
commit message's "118 existing + 10 new = 128" total was itself
measured with a contaminated `dist/` present — see "Done — fix
dist/test contamination" below; the real post-fix count for the whole
suite is 44 unit / 84 total.)

Landed 5 minutes before the `ApiError` adoption above, so these throw
plain `Error` on their handler-level validation guards (ambiguous
match, no results, missing profile/folder). **Checked during the
2026-08-06 session and confirmed this is not an inconsistency** — every
handler-level validation guard in the codebase (the pre-existing
`sonarr_add_series`/`radarr_add_movie` lookup-no-results checks,
`lidarr_add_artist`, `readarr_add_author`, the `release_search`
"at least one id" guards) throws plain `Error` the same way. `ApiError`
is purpose-built for actual upstream HTTP failures (it requires a
`status` code) and is used exclusively inside `ServarrClient`'s
request methods — using it for a business-logic refusal like "3 movies
matched, refusing to guess" would misuse the type, not fix anything.

## Done (fix — dist/test contamination)

Discovered while investigating why Dependabot PR #11's CI ran
suspiciously long. `tsconfig.json` had no exclusion for test files
(`"include": ["src/**/*"]`), so `npm run build` compiled every
`src/**/*.test.ts` into `dist/**/*.test.js` alongside real source.
Two consequences:

1. **Every reported test count in this repo's history is inflated.**
   CI's `Test` job runs `Build` before `Test` (`.github/workflows/test.yml`),
   so by the time `npm run test` (plain `vitest run`, no excludes) ran,
   `dist/` already held 10 duplicate compiled test files. Vitest has
   no `dist/` exclusion configured either, so it silently ran both
   copies. Verified the true baseline with a clean `dist/`: **6 unit
   test files / 44 tests**, **10 files / 84 tests** total (unit +
   integration) — not the 128/118/66/59 figures scattered through this
   document's history, all of which were apparently measured the same
   contaminated way.
2. **Worse than cosmetic.** `test:unit`'s `--exclude=**/*.integration.test.ts`
   flag only matches the `.ts` extension. A contaminated `dist/` means
   that flag fails to exclude the *compiled* `.js` integration tests,
   so the "safe, no-live-credentials-needed" `test:unit` command could
   silently execute the real integration suite against production
   Sonarr/Radarr/Lidarr/Prowlarr whenever `dist/` existed from a prior
   local build. The suite is read-only, so no harm done in practice,
   but not the guarantee that command exists to make.

Fix: added `"src/**/*.test.ts"` to `tsconfig.json`'s `exclude`. Test
files never reach `dist/` now — verified with a clean rebuild (0
`*.test.js` files emitted) and confirmed `test`/`test:unit` report the
correct counts even with `dist/` present, matching CI's exact
Build-then-Test step order. Bonus: also stops 10 unnecessary test
files from shipping in the published npm package and the Docker image
(`package.json`'s `"files": ["dist"]` and the Dockerfile's
`COPY --from=build .../dist` both include whatever `tsc` emits).

## Done (dependency updates — express 5, zod 4, typescript 6, @types majors)

Dependabot PR #11 bundled five major-version bumps (`express`,
`@types/express`, `zod`, `@types/node`, `typescript`) into one group;
its CI was red across every job. Investigated by checking the branch
out into a worktree and reproducing locally rather than reading CI
logs blind.

**`typescript` 5.9.3 → 7.0.2 (what PR #11 wanted) is categorically
blocked, not just untested.** `typescript-eslint@8.65.0` (its latest
release 8.66.0, and even its `canary` pre-release channel, all checked
directly) caps its peer dependency at `typescript@">=4.8.4 <6.1.0"` —
TypeScript past 6.1 isn't supported by `typescript-eslint` in any
published channel yet, upstream. `npm install` fails on the peer
conflict before any test or lint step runs, which is why every CI job
in PR #11 failed identically. No ETA; revisit once `typescript-eslint`
adds newer support.

**But TypeScript's own version history has a gap worth knowing:** it
jumped straight from the 5.9.x line to 6.0.x to 7.0.x — 6.1, 6.2, etc.
never existed. That means `typescript-eslint`'s `<6.1.0` cap actually
covers the *entire* 6.0.x line, including its latest stable release,
6.0.3. Verified `6.0.3` directly in an isolated worktree first (clean
install, no peer conflict, typecheck/lint/build/tests all green), then
applied it for real: `typescript` 5.9.3 → **6.0.3**. Full clean-room
verification on `main`: typecheck/lint/format/build clean, `npm audit`
0 vulnerabilities, full test suite green (10 files / 84 tests,
including the real read-only integration suite). No runtime smoke test
needed here — TypeScript is compile-time only, no shipped runtime
behavior to exercise the way express/zod had.

**The other four majors are also safe and applied directly** (not
through Dependabot's bundled PR): `express` 4→5, `@types/express` 4→5,
`zod` 3→4, `@types/node` 22→26. Verified against current `main` (PR
#11's branch predated the 2026-08-05 security-hardening and quick-add
commits by two days, so testing its stale branch directly would have
been misleading): typecheck/lint/format/build all clean, full test
suite green. Went beyond static checks given the blast radius — `zod`
backs every tool's `inputSchema` and `express` backs the HTTP
transport — with a live smoke test: booted the server in HTTP mode
against real credentials, hit `/health`, completed a real MCP
`initialize` handshake, and called `tools/list` across all 122
registered tools including `radarr_grab_release`/`sonarr_grab_release`/
etc., the only schemas using `.passthrough()`. All worked. Codebase
only uses zod's core primitives (`z.object`/`.string`/`.number`/
`.enum`/`.array`/`.passthrough`) — none of the v3→v4 renamed/deprecated
string-format methods (`.email()`, `.url()`, etc.) appear anywhere.

PR #11 closed (see PR comment) in favor of this split. A fresh
Dependabot PR for the remaining `typescript` 7.0.2 bump will reappear
automatically and will keep failing until `typescript-eslint` adds
6.1+/7.x support — at which point revisit; the 6.0.3 stopgap above is
not itself something to chase further improvements on.

## Next

1. **Smoke-test `lidarr_grab_release` / `readarr_grab_release`** —
   confirm whether Lidarr's lack of mapped fields just works.
   Readarr's tool ships in code but the deploy disables Readarr,
   so its real test will wait until the Goodreads upstream is back.
2. **Write integration tests + indexer-search opt-in fixture** —
   the read-only integration suite is live (40 tests). Write ops
   (`add_*`, `edit_*`, `grab_release`, `queue_remove`,
   `history_mark_failed`) and indexer-hitting ops (`release_search`,
   `prowlarr_search`) still need either a separate test instance or
   no-op patterns to safely exercise against the real library.
3. **Optional later additions**: `radarr_edit_collection`
   (collection-level monitoring, Radarr-specific),
   `lidarr_monitor_albums` / `readarr_monitor_books` (bulk monitor
   toggles), per-season/episode monitor tools for Sonarr.
4. **Update issue #9** (`[standards-gap] ts-mcp-server v1.0`) — its
   three P0 judgment findings (MCP-F03 transport hardening, MCP-P04
   field redaction, MCP-F01/F02/F04 timeout/typed-errors/retry) are
   now resolved by the security-hardening work above, but the issue's
   checkboxes haven't been updated to reflect it. The other ~9
   adoption-debt items (canonical `shared/` layout — partially done —
   container `HEALTHCHECK`, `.editorconfig`, `naming.test.ts`,
   version-sync test, etc.) are still genuinely open.

## Open Decisions

- **Per-call timeout override for `searchReleases`.** Resolved to a
  flat 30s timeout everywhere on 2026-08-05 (see "Done — outbound
  timeout, typed errors, bounded retry" above), not the two-tier
  30s/120s split originally pitched. Revisit only if a legitimately
  slow 30-60s `release_search` starts hitting the 30s ceiling in
  practice.

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

- **Lockfile is Windows-generated; cross-platform peers aren't
  pinned.** Symptom: `npm ci` fails on Linux Docker builds with
  `Missing: @emnapi/core@1.10.0 from lock file`. Workaround: the
  Dockerfile and Test workflow both use `npm install` instead of
  `npm ci`. Cost: arm64 publishes were dropped because
  QEMU + `npm install` hangs. Proper fix: regenerate
  `package-lock.json` from a Linux container so Linux/macOS
  optional peers (`@rollup/rollup-linux-*`, `@emnapi/*`) land in
  the lockfile, then revert Dockerfile + workflow to `npm ci` and
  re-add `linux/arm64` to `platforms`.
- Read-only integration tests live (40 tests against the user's
  real *arr instances, env-gated, skip cleanly in CI). **Write
  integration tests still pending** — would need a dedicated test
  instance or no-op patterns to safely exercise add/edit/grab
  against a production library.
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
