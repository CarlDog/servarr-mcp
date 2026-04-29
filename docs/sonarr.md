# Sonarr — endpoint catalogue & tool decisions

TV management. `/api/v3` (Sonarr v4 series). For cross-cutting Servarr
patterns (auth, paging, command pattern, errors), see
[SERVARR-API.md](SERVARR-API.md).

Spec: [`docs/specs/sonarr.json`](specs/sonarr.json) — pinned to
`v4.0.17.2952`. **162 paths, 234 operations, 42 top-level resources.**

This is a living document. Update when we add tools, when we hit a
gotcha, or when the spec snapshot is refreshed.

## Resource catalogue

Grouped by what they do, not by URL prefix. Each row is a Sonarr
resource family — see the spec for full per-endpoint detail.

### Library — TV catalogue & lookup

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `series`              | GET, POST, PUT, DELETE | Series CRUD. POST adds a new series (after lookup); DELETE supports `?deleteFiles=true&addImportListExclusion=true`. |
| `series/lookup`       | GET                    | TVDB fuzzy search. Returns candidate series — *not yet* in the local library. |
| `series/editor`       | PUT, DELETE            | **Bulk** edit/delete by ids array. High blast radius via LLM.        |
| `series/import`       | POST                   | Import existing series folders from disk.                            |
| `series/{id}/folder`  | GET                    | Path that would be used for the series — pre-add sanity check.       |
| `episode`             | GET, PUT               | Episode list (filterable by `seriesId`, `episodeIds`). PUT edits a single episode. |
| `episode/monitor`     | PUT                    | Bulk monitor toggle for a list of episode ids.                       |
| `episodefile`         | GET, PUT, DELETE       | The actual file rows behind episodes. DELETE removes the file from disk. |

### Status — what's downloading, what's missing, what happened

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `queue`               | GET, DELETE            | Active downloads (paged). `DELETE /queue/{id}?removeFromClient=true&blocklist=true` removes from queue and optionally from the download client + blocklists. |
| `queue/grab/{id}`     | POST                   | Force-grab a queue item that's stuck.                                |
| `queue/details`       | GET                    | Per-item details enriched with series/episode info.                  |
| `queue/status`        | GET                    | Aggregated queue counts (downloading/queued/warning).                |
| `history`             | GET                    | Paged history (newest first). Filters: `eventType`, `seriesId`, `episodeId`. |
| `history/since`       | GET                    | History from a given timestamp — useful for incremental polling.     |
| `history/series`      | GET                    | Per-series history — bypasses paging.                                |
| `history/failed/{id}` | POST                   | Mark a history item as failed → triggers re-search.                  |
| `wanted/missing`      | GET                    | Episodes wanted but not yet downloaded (paged).                      |
| `wanted/cutoff`       | GET                    | Episodes downloaded but below cutoff quality (upgrade candidates).   |
| `calendar`            | GET                    | Air-date calendar across monitored series. `?start=&end=&unmonitored=`. |
| `blocklist`           | GET, DELETE            | Releases that have been blocked from re-grab.                        |

### Releases & search (the actual download trigger surface)

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `release`             | GET, POST              | `GET /release?seriesId=&episodeId=&seasonNumber=` runs a manual indexer search and returns candidate releases. `POST /release` grabs a specific release (the canonical "click download" action). |
| `release/push`        | POST                   | Submit an arbitrary release URL — power-user flow.                   |
| `manualimport`        | GET, POST              | Stage and commit manual imports for files Sonarr didn't grab.        |
| `parse`               | GET                    | Run a release name through Sonarr's parser without grabbing.         |
| `command`             | GET, POST, DELETE      | Async action trigger. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions). |

### Configuration (server settings)

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `qualityprofile`      | List/CRUD quality profiles. Required input for adding a series (POST /series body needs `qualityProfileId`). |
| `qualitydefinition`   | Per-quality min/max size. Power-user.                                      |
| `languageprofile`     | Sonarr-specific (Radarr collapsed this into qualityprofile).               |
| `customformat`        | Custom formats for fine-grained release scoring.                           |
| `releaseprofile`      | Required/preferred/ignored words for release filtering.                    |
| `delayprofile`        | Hold a release for N minutes to allow a better one to land.                |
| `autotagging`         | Auto-apply tags based on rules.                                            |
| `customfilter`        | Saved filter expressions for the UI.                                       |
| `tag`                 | Generic tag CRUD. Used for grouping series, scoping notifications, etc.    |
| `rootfolder`          | List of paths Sonarr will create series folders under. Required for POST /series. |
| `remotepathmapping`   | Translate paths between download client and Sonarr.                        |
| `importlist` / `importlistexclusion` | Sources of series to auto-import (Trakt lists, etc.) and exclusions. |
| `indexer` / `indexerflag` | Indexer connection management (also: `/test`, `/testall`, `/action/{name}`, `/schema`). |
| `downloadclient`      | Download client management (same shape as indexer).                        |
| `notification`        | Notification provider management (same shape).                             |
| `metadata`            | Metadata-file consumer management (same shape).                            |
| `config/*`            | Server-level config sections (host, mediamanagement, naming, ui, downloadclient, importlist, indexer). PUT-able. |
| `seasonpass`          | Bulk monitor/unmonitor seasons across many series.                         |

### System / diagnostic

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `system/status`       | Version, branch, runtime info — used by `health` checks.                   |
| `system/task`         | Scheduled tasks (housekeeping, RSS sync, etc.).                            |
| `system/backup`       | Backup CRUD — server admin.                                                |
| `system/restart`, `system/shutdown` | Server lifecycle. **Don't expose via MCP.**                  |
| `health`              | Aggregated health warnings (indexer down, low disk, etc.).                 |
| `diskspace`           | Per-mount free/total space. Useful before adding a series.                 |
| `update`              | Available app updates.                                                     |
| `log` / `log/file`    | Server logs. Diagnostic.                                                   |
| `localization`        | UI string tables. Not useful for MCP tools.                                |
| `mediacover`          | Series posters/banners — image bytes, not JSON.                            |
| `filesystem`          | Path browser used by the UI when picking root folders.                     |

## Currently exposed tools

| Tool                  | Endpoint                            | Notes                              |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `sonarr_list_series`  | `GET /series`                       | All series, no filter.             |
| `sonarr_get_series`   | `GET /series/{id}`                  |                                    |
| `sonarr_lookup_series`| `GET /series/lookup?term=`          | TVDB fuzzy match for new adds.     |
| `sonarr_list_episodes`| `GET /episode?seriesId=`            | All episodes for a series.         |
| `sonarr_calendar`     | `GET /calendar?start=&end=`         | ISO date window.                   |
| `sonarr_queue`        | `GET /queue`                        | Inherited from `ServarrClient.queue()`. No paging exposed yet — needs `page`/`pageSize` inputs when the queue grows. |
| `sonarr_history`      | `GET /history?pageSize=&sortKey=date&sortDirection=descending` | Inherited from base; only `page_size` exposed. |

## Candidate tools — read

Quick wins. Most are one-line additions over the existing client.

| Tool name                  | Endpoint                              | Why                                                              |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `sonarr_get_episode`       | `GET /episode/{id}`                   | Drill-down for a single episode.                                 |
| `sonarr_wanted_missing`    | `GET /wanted/missing` (paged)         | "What episodes am I missing?" — top-tier user query.             |
| `sonarr_wanted_cutoff`     | `GET /wanted/cutoff` (paged)          | Upgrade candidates.                                              |
| `sonarr_history_series`    | `GET /history/series?seriesId=`       | Per-series history without paging.                               |
| `sonarr_health`            | `GET /health`                         | Surfaces indexer-down / low-disk warnings.                       |
| `sonarr_diskspace`         | `GET /diskspace`                      | Inform "where to add this series" decisions.                     |
| `sonarr_list_quality_profiles` | `GET /qualityprofile`             | Required prerequisite for the add-series tool.                   |
| `sonarr_list_root_folders` | `GET /rootfolder`                     | Required prerequisite for the add-series tool.                   |
| `sonarr_list_tags`         | `GET /tag`                            | Required for any tool that scopes by tag.                        |
| `sonarr_list_indexers`     | `GET /indexer`                        | Diagnostic.                                                      |
| `sonarr_list_download_clients` | `GET /downloadclient`             | Diagnostic.                                                      |
| `sonarr_release_search`    | `GET /release?seriesId=&episodeId=&seasonNumber=` | Manual indexer search; returns candidates without grabbing. |
| `sonarr_parse_release`     | `GET /parse?title=`                   | Sanity-check what Sonarr thinks a release name is.               |
| `sonarr_queue_paged`       | `GET /queue` (with `page`, `pageSize`, filters) | Replaces `sonarr_queue` once paging matters.            |

## Candidate tools — write

Higher value, higher risk. Each should be added *with the prerequisite
read tool already in place* — e.g. don't ship add-series without
list-quality-profiles + list-root-folders, since the LLM has to
choose ids.

| Tool name                  | Endpoint                              | Risk class | Notes                                                              |
| -------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `sonarr_add_series`        | `POST /series` (body: `SeriesResource`) | Medium   | Needs `tvdbId`, `qualityProfileId`, `rootFolderPath`, `monitored`, `addOptions.searchForMissingEpisodes`. Must come from a prior `lookup_series` call. |
| `sonarr_edit_series`       | `PUT /series/{id}`                    | Medium     | Toggle monitor, change quality profile, change root folder. Single-series.  |
| `sonarr_monitor_episodes`  | `PUT /episode/monitor` (body: `EpisodesMonitoredResource`) | Low | Bulk monitor toggle by episode ids — common workflow ("monitor S03E07 and the rest"). |
| `sonarr_search_series`     | `POST /command` (`name: "SeriesSearch"`) | Low      | Trigger a full-series search.                                      |
| `sonarr_search_season`     | `POST /command` (`name: "SeasonSearch"`) | Low      | Trigger a season search.                                           |
| `sonarr_search_episode`    | `POST /command` (`name: "EpisodeSearch"`) | Low     | Trigger an episode search.                                         |
| `sonarr_refresh_series`    | `POST /command` (`name: "RefreshSeries"`) | Low     | Re-pull metadata from TVDB.                                        |
| `sonarr_search_missing`    | `POST /command` (`name: "MissingEpisodeSearch"`) | Low | Search across all monitored, missing episodes.                     |
| `sonarr_get_command`       | `GET /command/{id}`                   | Low        | Companion poll for any of the above.                               |
| `sonarr_grab_release`      | `POST /release` (body: `ReleaseResource`) | High   | Grab a specific release returned by `release_search`. Defer until release_search ships. |
| `sonarr_queue_remove`      | `DELETE /queue/{id}?removeFromClient=&blocklist=` | Medium | Single item only; no bulk.                                |
| `sonarr_queue_regrab`      | `POST /queue/grab/{id}`               | Low        | Force re-grab of a stuck queue item.                               |
| `sonarr_history_mark_failed` | `POST /history/failed/{id}`         | Medium     | Marks a history item failed → triggers re-search.                  |

## Out of scope

These are intentionally not exposed. The cost of an LLM mis-firing
is too high relative to the benefit.

| Capability                    | Endpoint(s)                                                | Why                                                                  |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete series                 | `DELETE /series/{id}?deleteFiles=true`                     | Combines library removal with on-disk file deletion. LLM
hallucination cost is files-gone. If we ever ship it, gate behind a confirmation flow. |
| Bulk series edit/delete       | `PUT /series/editor`, `DELETE /series/editor`              | Same reason, multiplied by N.                                        |
| Delete episode files          | `DELETE /episodefile/{id}`, `DELETE /episodefile/bulk`     | Removes media from disk.                                             |
| Generic command runner        | `POST /command` with arbitrary name                        | Specific commands are exposed individually (above) so we can scope inputs. A generic runner would let the LLM run any command. |
| Server lifecycle              | `POST /system/restart`, `POST /system/shutdown`            | Out of band — operator concern.                                      |
| Server backups                | `GET /system/backup`, `DELETE /system/backup/{id}`, `POST /system/backup/restore/*` | Operator concern.                            |
| Config writes                 | `PUT /config/*`                                            | Server settings — out of MCP scope; manage in Sonarr UI.             |
| Indexer/downloadclient/notification/metadata writes | `POST/PUT/DELETE` on these resources | Configuration. Same reasoning as config writes.            |

## Sonarr-specific gotchas

(Empty — populate as we hit them. Anchor candidates from prior
experience and the spec inspection so far:)

- **`POST /series` is picky about `addOptions`.** The `addOptions`
  sub-object decides whether Sonarr searches immediately, monitors
  the new series' first season only, etc. Defaults may not be what a
  user expects. When wiring `sonarr_add_series`, make these
  decisions explicit zod inputs with comments, not defaults.
- **`languageprofile` exists in Sonarr but not in Radarr.** Radarr
  collapsed language settings into `qualityprofile`. Don't share
  add-media logic across apps.
- **`PUT /series/{id}` requires the full `SeriesResource` payload.**
  Partial updates aren't supported — fetch the existing series with
  `GET /series/{id}`, mutate the field(s), PUT the whole thing back.
  Easy LLM trap: send a sparse object → 400.
- **Queue removal flags are cross-cutting.** See
  [SERVARR-API.md § DELETE /queue/{id} flags](SERVARR-API.md#delete-queueid-flags-are-identical-across-the-4-media-apps) —
  the four flags (`removeFromClient`, `blocklist`, `skipRedownload`,
  `changeCategory`) and their defaults are identical across Sonarr,
  Radarr, Lidarr, and Readarr.
