# Radarr — endpoint catalogue & tool decisions

Movie management. `/api/v3` (Radarr v6 series). For cross-cutting Servarr
patterns (auth, paging, command pattern, errors), see
[SERVARR-API.md](SERVARR-API.md).

Spec: [`docs/specs/radarr.json`](specs/radarr.json) — pinned to
`v6.1.1.10360`. **164 paths, 237 operations, 43 top-level resources.**

This is a living document. Update when we add tools, when we hit a
gotcha, or when the spec snapshot is refreshed.

## Resource catalogue

Grouped by what they do, not by URL prefix. Each row is a Radarr
resource family — see the spec for full per-endpoint detail.

### Library — movie catalogue & lookup

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `movie`               | GET, POST, PUT, DELETE | Movie CRUD. POST adds a new movie (after lookup); DELETE supports `?deleteFiles=true&addImportExclusion=true`. |
| `movie/lookup`        | GET                    | TMDB fuzzy search (`?term=`). Returns candidate movies — *not yet* in the local library. |
| `movie/lookup/tmdb`   | GET                    | Direct TMDB-id lookup (`?tmdbId=`). Use when the id is already known. |
| `movie/lookup/imdb`   | GET                    | Direct IMDB-id lookup (`?imdbId=tt...`).                             |
| `movie/editor`        | PUT, DELETE            | **Bulk** edit/delete by ids array. High blast radius via LLM.        |
| `movie/import`        | POST                   | Import existing movie folders from disk.                             |
| `movie/{id}/folder`   | GET                    | Path that would be used for the movie — pre-add sanity check.        |
| `moviefile`           | GET, PUT, DELETE       | The actual file rows behind movies (filterable by `movieId`). DELETE removes the file from disk. |
| `moviefile/editor`    | PUT                    | Bulk metadata edit on multiple movie files.                          |
| `moviefile/bulk`      | PUT, DELETE            | Bulk update/delete movie files by ids.                               |
| `collection`          | GET, PUT               | Movie collections (e.g. "Marvel Cinematic Universe"). PUT toggles collection-level monitoring/quality. Radarr-only — no Sonarr equivalent. |
| `alttitle`            | GET                    | Alternate titles (regional / translated) for a movie. Filter by `movieId` or `movieMetadataId`. Radarr-only. |
| `credit`              | GET                    | Cast & crew credits per movie. Filter by `movieId` or `movieMetadataId`. Radarr-only. |
| `extrafile`           | GET                    | Extras files (trailers, behind-the-scenes) tracked per movie. Radarr-only. |

### Status — what's downloading, what's missing, what happened

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `queue`               | GET, DELETE            | Active downloads (paged). `DELETE /queue/{id}?removeFromClient=&blocklist=&skipRedownload=&changeCategory=` removes from queue with fine-grained options. |
| `queue/bulk`          | DELETE                 | Bulk queue removal by ids.                                           |
| `queue/grab/{id}`     | POST                   | Force-grab a queue item that's stuck.                                |
| `queue/grab/bulk`     | POST                   | Bulk force-grab.                                                     |
| `queue/details`       | GET                    | Per-item details enriched with movie info.                           |
| `queue/status`        | GET                    | Aggregated queue counts (downloading/queued/warning).                |
| `history`             | GET                    | Paged history (newest first). Filters: `eventType`, `movieIds`, `downloadId`, `languages`, `quality`. |
| `history/since`       | GET                    | History from a given timestamp — useful for incremental polling.     |
| `history/movie`       | GET                    | Per-movie history (`?movieId=`) — bypasses paging.                   |
| `history/failed/{id}` | POST                   | Mark a history item as failed → triggers re-search.                  |
| `wanted/missing`      | GET                    | Movies wanted but not yet downloaded (paged, `?monitored=`).         |
| `wanted/cutoff`       | GET                    | Movies downloaded but below cutoff quality (upgrade candidates, paged). |
| `calendar`            | GET                    | Release-date calendar across monitored movies. `?start=&end=&unmonitored=&tags=`. |
| `blocklist`           | GET, DELETE            | Releases that have been blocked from re-grab. `blocklist/movie?movieId=` for per-movie. `blocklist/bulk` for bulk delete. |

### Releases & search (the actual download trigger surface)

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `release`             | GET, POST              | `GET /release?movieId=` runs a manual indexer search and returns candidate releases. `POST /release` grabs a specific release (the canonical "click download" action). |
| `release/push`        | POST                   | Submit an arbitrary release URL — power-user flow.                   |
| `manualimport`        | GET, POST              | Stage and commit manual imports for files Radarr didn't grab. GET filters: `folder`, `downloadId`, `movieId`, `filterExistingFiles`. |
| `parse`               | GET                    | Run a release name through Radarr's parser without grabbing (`?title=`). |
| `command`             | GET, POST, DELETE      | Async action trigger. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions). |

### Configuration (server settings)

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `qualityprofile`      | List/CRUD quality profiles. Required input for adding a movie (POST /movie body needs `qualityProfileId`). Language settings are nested **inside** the quality profile in Radarr — there is no `languageprofile` resource. |
| `qualitydefinition`   | Per-quality min/max size. Power-user. Includes `/qualitydefinition/limits`. |
| `customformat`        | Custom formats for fine-grained release scoring.                           |
| `releaseprofile`      | Required/preferred/ignored words for release filtering.                    |
| `delayprofile`        | Hold a release for N minutes to allow a better one to land. Reorderable via `/delayprofile/reorder/{id}`. |
| `autotagging`         | Auto-apply tags based on rules.                                            |
| `customfilter`        | Saved filter expressions for the UI.                                       |
| `tag`                 | Generic tag CRUD. Used for grouping movies, scoping notifications, etc. `tag/detail` shows what each tag is attached to. |
| `rootfolder`          | List of paths Radarr will create movie folders under. Required for POST /movie. |
| `remotepathmapping`   | Translate paths between download client and Radarr.                        |
| `importlist` / `exclusions` | Sources of movies to auto-import (Trakt, TMDb lists, etc.) and per-movie exclusions. Exclusions has `paged`, `bulk`, and per-movie variants. |
| `indexer` / `indexerflag` | Indexer connection management (also: `/test`, `/testall`, `/action/{name}`, `/schema`). |
| `downloadclient`      | Download client management (same shape as indexer).                        |
| `notification`        | Notification provider management (same shape).                             |
| `metadata`            | Metadata-file consumer management (same shape).                            |
| `config/*`            | Server-level config sections (host, mediamanagement, naming, ui, downloadclient, importlist, indexer, metadata). PUT-able. `/config/naming/examples` previews naming patterns. |
| `language`            | Read-only language list (id ↔ name). Used as input to quality profiles.    |

### System / diagnostic

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `system/status`       | Version, branch, runtime info — used by `health` checks.                   |
| `system/task`         | Scheduled tasks (housekeeping, RSS sync, etc.).                            |
| `system/backup`       | Backup CRUD — server admin. Includes `restore/{id}` and `restore/upload`.  |
| `system/restart`, `system/shutdown` | Server lifecycle. **Don't expose via MCP.**                  |
| `system/routes`       | Internal route enumeration (and `routes/duplicate`). Diagnostic only.      |
| `health`              | Aggregated health warnings (indexer down, low disk, etc.).                 |
| `diskspace`           | Per-mount free/total space. Useful before adding a movie.                  |
| `update`              | Available app updates.                                                     |
| `log` / `log/file`    | Server logs. Diagnostic. `log/file/update/...` for update-channel logs.    |
| `localization`        | UI string tables. Not useful for MCP tools.                                |
| `mediacover`          | Movie posters/banners — image bytes, not JSON.                             |
| `filesystem`          | Path browser used by the UI when picking root folders. `/type` and `/mediafiles` variants. |
| `rename`              | Preview rename plan for a movie's files.                                   |

## Currently exposed tools

| Tool                  | Endpoint                            | Notes                              |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `radarr_list_movies`  | `GET /movie`                        | All movies, no filter.             |
| `radarr_get_movie`    | `GET /movie/{id}`                   |                                    |
| `radarr_lookup_movie` | `GET /movie/lookup?term=`           | TMDB fuzzy match for new adds. Doesn't expose the `tmdb`/`imdb` direct-id variants yet. |
| `radarr_calendar`     | `GET /calendar?start=&end=`         | ISO date window. Doesn't expose `unmonitored` or `tags` filters yet. |
| `radarr_queue`        | `GET /queue`                        | Inherited from `ServarrClient.queue()`. No paging exposed yet — needs `page`/`pageSize` inputs when the queue grows. |
| `radarr_history`      | `GET /history?pageSize=&sortKey=date&sortDirection=descending` | Inherited from base; only `page_size` exposed. |

## Candidate tools — read

Quick wins. Most are one-line additions over the existing client.

| Tool name                     | Endpoint                              | Why                                                              |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `radarr_lookup_tmdb`          | `GET /movie/lookup/tmdb?tmdbId=`      | Direct hit when the user already has a TMDB id.                  |
| `radarr_lookup_imdb`          | `GET /movie/lookup/imdb?imdbId=`      | Direct hit when the user already has an IMDB id.                 |
| `radarr_wanted_missing`       | `GET /wanted/missing` (paged)         | "What movies am I missing?" — top-tier user query.               |
| `radarr_wanted_cutoff`        | `GET /wanted/cutoff` (paged)          | Upgrade candidates.                                              |
| `radarr_history_movie`        | `GET /history/movie?movieId=`         | Per-movie history without paging.                                |
| `radarr_health`               | `GET /health`                         | Surfaces indexer-down / low-disk warnings.                       |
| `radarr_diskspace`            | `GET /diskspace`                      | Inform "where to add this movie" decisions.                      |
| `radarr_list_quality_profiles`| `GET /qualityprofile`                 | Required prerequisite for the add-movie tool.                    |
| `radarr_list_root_folders`    | `GET /rootfolder`                     | Required prerequisite for the add-movie tool.                    |
| `radarr_list_tags`            | `GET /tag`                            | Required for any tool that scopes by tag.                        |
| `radarr_list_indexers`        | `GET /indexer`                        | Diagnostic.                                                      |
| `radarr_list_download_clients`| `GET /downloadclient`                 | Diagnostic.                                                      |
| `radarr_list_collections`     | `GET /collection`                     | Lists movie collections — Radarr-only feature, useful for "what's in the MCU?" type queries. |
| `radarr_release_search`       | `GET /release?movieId=`               | Manual indexer search; returns candidates without grabbing.      |
| `radarr_parse_release`        | `GET /parse?title=`                   | Sanity-check what Radarr thinks a release name is.               |
| `radarr_queue_paged`          | `GET /queue` (with `page`, `pageSize`, filters) | Replaces `radarr_queue` once paging matters.            |

## Candidate tools — write

Higher value, higher risk. Each should be added *with the prerequisite
read tool already in place* — e.g. don't ship add-movie without
list-quality-profiles + list-root-folders, since the LLM has to
choose ids.

| Tool name                  | Endpoint                              | Risk class | Notes                                                              |
| -------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `radarr_add_movie`         | `POST /movie` (body: `MovieResource`) | Medium     | Needs `tmdbId`, `qualityProfileId`, `rootFolderPath`, `monitored`, `addOptions.searchForMovie`. Must come from a prior `lookup_movie` call. |
| `radarr_edit_movie`        | `PUT /movie/{id}`                     | Medium     | Toggle monitor, change quality profile, change root folder. Single-movie. |
| `radarr_edit_collection`   | `PUT /collection/{id}` or `PUT /collection` | Medium | Toggle collection-level monitoring (e.g. monitor every MCU film as it releases). Radarr-only. |
| `radarr_search_movie`      | `POST /command` (`name: "MoviesSearch"`) | Low     | Trigger a search for one or more specific movies. (Verify exact name — `MoviesSearch` vs `MovieSearch` — by reading source or making a test call; spec doesn't enumerate command names. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions).) |
| `radarr_refresh_movie`     | `POST /command` (`name: "RefreshMovie"`) | Low     | Re-pull metadata from TMDB.                                        |
| `radarr_search_missing`    | `POST /command` (`name: "MissingMoviesSearch"`) | Low | Search across all monitored, missing movies.                       |
| `radarr_get_command`       | `GET /command/{id}`                   | Low        | Companion poll for any of the above.                               |
| `radarr_grab_release`      | `POST /release` (body: `ReleaseResource`) | High   | Grab a specific release returned by `release_search`. Defer until release_search ships. |
| `radarr_queue_remove`      | `DELETE /queue/{id}?removeFromClient=&blocklist=&skipRedownload=&changeCategory=` | Medium | Single item only; no bulk. Surface all four flags explicitly. |
| `radarr_queue_regrab`      | `POST /queue/grab/{id}`               | Low        | Force re-grab of a stuck queue item.                               |
| `radarr_history_mark_failed` | `POST /history/failed/{id}`         | Medium     | Marks a history item failed → triggers re-search.                  |
| `radarr_add_exclusion`     | `POST /exclusions`                    | Low        | Prevent a TMDB id from ever being auto-imported (e.g. "stop suggesting this trash").  |

## Out of scope

These are intentionally not exposed. The cost of an LLM mis-firing
is too high relative to the benefit.

| Capability                    | Endpoint(s)                                                | Why                                                                  |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete movie                  | `DELETE /movie/{id}?deleteFiles=true`                      | Combines library removal with on-disk file deletion. LLM hallucination cost is files-gone. If we ever ship it, gate behind a confirmation flow. |
| Bulk movie edit/delete        | `PUT /movie/editor`, `DELETE /movie/editor`                | Same reason, multiplied by N.                                        |
| Delete movie files            | `DELETE /moviefile/{id}`, `DELETE /moviefile/bulk`         | Removes media from disk.                                             |
| Bulk queue removal            | `DELETE /queue/bulk`                                       | Single-item removal is exposed; bulk is a foot-gun.                  |
| Generic command runner        | `POST /command` with arbitrary name                        | Specific commands are exposed individually (above) so we can scope inputs. A generic runner would let the LLM run any command. |
| Server lifecycle              | `POST /system/restart`, `POST /system/shutdown`            | Out of band — operator concern.                                      |
| Server backups                | `GET /system/backup`, `DELETE /system/backup/{id}`, `POST /system/backup/restore/*` | Operator concern.                            |
| Config writes                 | `PUT /config/*`                                            | Server settings — out of MCP scope; manage in Radarr UI.             |
| Indexer/downloadclient/notification/metadata writes | `POST/PUT/DELETE` on these resources | Configuration. Same reasoning as config writes.            |

## Radarr-specific gotchas

- **`languageprofile` does not exist.** Sonarr has a separate
  `languageprofile` resource; Radarr collapsed language settings into
  `qualityprofile` (the language list is nested inside each quality
  profile). Don't share add-media logic across Sonarr and Radarr —
  the request bodies diverge here.
- **No `episode` / `episodefile` / `seasonpass`.** Movies are single
  units. Where Sonarr has `series → season → episode → episodefile`,
  Radarr has just `movie → moviefile`. Tools that operate per-episode
  in Sonarr have no analog here.
- **`addImportExclusion`, not `addImportListExclusion`.** The
  `DELETE /movie/{id}` query flag is named `addImportExclusion` in
  Radarr (Sonarr's `DELETE /series/{id}` uses `addImportListExclusion`).
  Easy to mix up if you copy-paste from the Sonarr tool.
- **`POST /movie` `addOptions` is picky.** The `addOptions` sub-object
  decides whether Radarr searches immediately, what monitoring profile
  to use, etc. Radarr's flag is `searchForMovie` (singular), not
  Sonarr's `searchForMissingEpisodes`. Make these explicit zod inputs
  with comments, not defaults.
- **`PUT /movie/{id}` requires the full `MovieResource` payload.**
  Same trap as Sonarr: partial updates aren't supported. Fetch with
  `GET /movie/{id}`, mutate the field(s), PUT the whole thing back.
  Sparse object → 400.
- **Queue removal flags are cross-cutting.** See
  [SERVARR-API.md § DELETE /queue/{id} flags](SERVARR-API.md#delete-queueid-flags-are-identical-across-the-4-media-apps) —
  Radarr's `DELETE /queue/{id}` flags are byte-identical to Sonarr's,
  Lidarr's, and Readarr's (verified in the spec snapshots).
- **Three lookup endpoints, not one.** `/movie/lookup` (term),
  `/movie/lookup/tmdb` (id), and `/movie/lookup/imdb` (id). The
  direct-id variants are faster and unambiguous when the id is
  already known — wire all three rather than forcing fuzzy search
  through `term`.
- **`MoviesSearch` vs `MovieSearch` command name — verify before
  shipping.** The spec's `command` resource doesn't enumerate command
  names (see [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions)).
  Both names appear in the wild; check the Radarr source
  (`src/NzbDrone.Core/Movies/Commands/`) or make a test call before
  hard-coding a name in a tool.
