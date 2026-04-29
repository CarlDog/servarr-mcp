# Lidarr — endpoint catalogue & tool decisions

Music management. `/api/v1` (Lidarr v3 series). For cross-cutting Servarr
patterns (auth, paging, command pattern, errors), see
[SERVARR-API.md](SERVARR-API.md).

Spec: [`docs/specs/lidarr.json`](specs/lidarr.json) — pinned to
`v3.1.0.4875`. **161 paths, 235 operations, 50 top-level resources.**

This is a living document. Update when we add tools, when we hit a
gotcha, or when the spec snapshot is refreshed.

## Resource catalogue

Grouped by what they do, not by URL prefix. Each row is a Lidarr
resource family — see the spec for full per-endpoint detail. Music
has a three-level hierarchy: **artist → album → track**, and the
catalogue is shaped around that.

### Library — music catalogue & lookup

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `artist`              | GET, POST, PUT, DELETE | Artist CRUD. POST adds a new artist (after lookup); needs both `qualityProfileId` and `metadataProfileId`. |
| `artist/lookup`       | GET                    | MusicBrainz fuzzy artist search. Returns candidates — *not yet* in the local library. |
| `artist/editor`       | PUT, DELETE            | **Bulk** edit/delete by `artistIds`. High blast radius via LLM.      |
| `album`               | GET, POST, PUT, DELETE | Album CRUD. GET filterable by `artistId`, `albumIds`, `foreignAlbumId`. POST adds a single album (typically used after `album/lookup`). |
| `album/lookup`        | GET                    | MusicBrainz fuzzy album search. Distinct from artist lookup.         |
| `album/monitor`       | PUT                    | Bulk monitor toggle for a list of album ids (body: `{ albumIds, monitored }`). |
| `albumstudio`         | POST                   | Bulk apply monitoring options across many artists' back-catalogue at once — the closest analogue to Sonarr's `seasonpass`. |
| `track`               | GET                    | Track list (filterable by `artistId`, `albumId`, `albumReleaseId`, `trackIds`). Read-only. |
| `track/{id}`          | GET                    | Single-track details.                                                |
| `trackfile`           | GET, PUT, DELETE       | The actual file rows backing tracks. Filter by `artistId`, `albumId`, `trackFileIds`, `unmapped`. DELETE removes the file from disk. |
| `trackfile/bulk`      | DELETE, PUT            | Bulk file ops. High blast radius.                                    |
| `trackfile/editor`    | PUT                    | Bulk edit (e.g. quality re-tag) across many trackfiles.              |
| `search`              | GET                    | Unified `?term=` search returning **either an artist or an album** (`SearchResource`). Convenience wrapper for the UI's "what is this?" box; not the same as `/release`. |

### Status — what's downloading, what's missing, what happened

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `queue`               | GET                    | Active downloads (paged). Filters: `includeUnknownArtistItems`, `artistIds`, `protocol`, `quality`. |
| `queue/{id}`          | DELETE                 | Remove a queue item. Flags: `removeFromClient`, `blocklist`, `skipRedownload`, `changeCategory`. |
| `queue/bulk`          | DELETE                 | Bulk remove. Same flags. High blast radius.                          |
| `queue/grab/{id}`     | POST                   | Force-grab a stuck queue item.                                       |
| `queue/grab/bulk`     | POST                   | Bulk force-grab.                                                     |
| `queue/details`       | GET                    | Per-item details enriched with `includeArtist` / `includeAlbum`.     |
| `queue/status`        | GET                    | Aggregated queue counts.                                             |
| `history`             | GET                    | Paged history (newest first). Filters: `eventType`, `artistId`, `albumId`. |
| `history/since`       | GET                    | History from a given timestamp — incremental polling.                |
| `history/artist`      | GET                    | Per-artist history — bypasses paging.                                |
| `history/failed/{id}` | POST                   | Mark a history item as failed → triggers re-search.                  |
| `wanted/missing`      | GET                    | Albums wanted but not yet downloaded (paged).                        |
| `wanted/missing/{id}` | GET                    | Single missing-album detail.                                         |
| `wanted/cutoff`       | GET                    | Albums downloaded but below cutoff quality (upgrade candidates).     |
| `wanted/cutoff/{id}`  | GET                    | Single cutoff-album detail.                                          |
| `calendar`            | GET                    | Album-release calendar (`?start=&end=&unmonitored=`).                |
| `calendar/{id}`       | GET                    | Single calendar entry.                                               |
| `blocklist`           | GET, DELETE            | Releases that have been blocked from re-grab.                        |

### Releases & search (the actual download trigger surface)

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `release`             | GET, POST              | `GET /release?artistId=&albumId=` runs a manual indexer search and returns candidate releases. `POST /release` grabs a specific release (canonical "click download" action). |
| `release/push`        | POST                   | Submit an arbitrary release URL — power-user flow.                   |
| `manualimport`        | GET, POST              | Stage and commit manual imports for files Lidarr didn't grab. GET filters by `folder`, `downloadId`, `artistId`. |
| `parse`               | GET                    | Run a release name through Lidarr's parser without grabbing.         |
| `command`             | GET, POST, DELETE      | Async action trigger. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions). |

### Configuration (server settings)

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `qualityprofile`      | List/CRUD quality profiles. **Required** input for adding an artist.       |
| `qualitydefinition`   | Per-quality min/max size. Power-user.                                      |
| `metadataprofile`     | **Lidarr-specific.** Filters which album types (Album/EP/Single, Studio/Live/Compilation) and release statuses (Official/Promotional/Bootleg/Pseudo-Release) get downloaded. **Also required** for POST /artist alongside `qualityProfileId`. |
| `customformat`        | Custom formats for fine-grained release scoring.                           |
| `releaseprofile`      | Required/preferred/ignored words for release filtering.                    |
| `delayprofile`        | Hold a release for N minutes to allow a better one to land.                |
| `autotagging`         | Auto-apply tags based on rules.                                            |
| `customfilter`        | Saved filter expressions for the UI.                                       |
| `tag`                 | Generic tag CRUD. Used for grouping artists, scoping notifications, etc.   |
| `rootfolder`          | List of paths Lidarr will create artist folders under. Required for POST /artist. |
| `remotepathmapping`   | Translate paths between download client and Lidarr.                        |
| `importlist` / `importlistexclusion` | Sources of artists to auto-import (Last.fm, Spotify, etc.) and exclusions. |
| `indexer` / `indexerflag` | Indexer connection management (also: `/test`, `/testall`, `/action/{name}`, `/schema`). |
| `downloadclient`      | Download client management (same shape as indexer).                        |
| `notification`        | Notification provider management (same shape).                             |
| `metadata`            | Metadata-file consumer management (same shape) — distinct from `metadataprofile`. |
| `config/*`            | Server-level config sections (host, mediamanagement, naming, ui, downloadclient, importlist, indexer, metadataprovider). PUT-able. |

### File operations (music-specific)

| Resource              | Verbs | Purpose                                                                       |
| --------------------- | ----- | ----------------------------------------------------------------------------- |
| `rename`              | GET   | Preview rename operations (`?artistId=&albumId=`) — what would change if naming were applied to existing files. |
| `retag`               | GET   | **Lidarr-specific.** Preview audio-file tag changes (`?artistId=&albumId=`). Returns a `RetagTrackResource` per file: current tags vs. what Lidarr would write. The actual rewrite is triggered via `POST /command` (`RetagFiles` / `RetagArtist`). |

### System / diagnostic

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `system/status`       | Version, branch, runtime info — used by `health` checks.                   |
| `system/task`         | Scheduled tasks (housekeeping, RSS sync, etc.).                            |
| `system/backup`       | Backup CRUD — server admin.                                                |
| `system/restart`, `system/shutdown` | Server lifecycle. **Don't expose via MCP.**                  |
| `system/routes`, `system/routes/duplicate` | Route enumeration — internal diagnostics.             |
| `health`              | Aggregated health warnings (indexer down, low disk, etc.).                 |
| `diskspace`           | Per-mount free/total space. Useful before adding an artist.                |
| `update`              | Available app updates.                                                     |
| `log` / `log/file`    | Server logs. Diagnostic. Includes `log/file/update` for update logs.       |
| `localization`        | UI string tables. Not useful for MCP tools.                                |
| `language`            | Language list — read-only in Lidarr (see gotchas).                         |
| `mediacover`          | Artist + album posters/banners — image bytes, not JSON.                    |
| `filesystem`          | Path browser used by the UI when picking root folders.                     |

## Currently exposed tools

| Tool                  | Endpoint                            | Notes                              |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `lidarr_list_artists` | `GET /artist`                       | All artists, no filter.            |
| `lidarr_get_artist`   | `GET /artist/{id}`                  |                                    |
| `lidarr_lookup_artist`| `GET /artist/lookup?term=`          | MusicBrainz fuzzy match for new adds. |
| `lidarr_list_albums`  | `GET /album?artistId=`              | All albums, optionally filtered to one artist. |
| `lidarr_queue`        | `GET /queue`                        | Inherited from `ServarrClient.queue()`. No paging exposed yet — needs `page`/`pageSize` inputs when the queue grows. |
| `lidarr_history`      | `GET /history?pageSize=&sortKey=date&sortDirection=descending` | Inherited from base; only `page_size` exposed. |

## Candidate tools — read

Quick wins. Most are one-line additions over the existing client.

| Tool name                     | Endpoint                              | Why                                                              |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `lidarr_get_album`            | `GET /album/{id}`                     | Drill-down for a single album.                                   |
| `lidarr_lookup_album`         | `GET /album/lookup?term=`             | MusicBrainz album search — needed for adding standalone albums.  |
| `lidarr_search`               | `GET /search?term=`                   | Unified artist/album search; thin wrapper over what the UI uses. |
| `lidarr_list_tracks`          | `GET /track?artistId=&albumId=`       | List tracks under an album (or all tracks for an artist).        |
| `lidarr_get_track`            | `GET /track/{id}`                     | Single-track detail.                                             |
| `lidarr_list_trackfiles`      | `GET /trackfile?artistId=&albumId=&unmapped=` | What's actually on disk; `unmapped=true` finds orphans.   |
| `lidarr_wanted_missing`       | `GET /wanted/missing` (paged)         | "What albums am I missing?" — top-tier user query.               |
| `lidarr_wanted_cutoff`        | `GET /wanted/cutoff` (paged)          | Upgrade candidates.                                              |
| `lidarr_history_artist`       | `GET /history/artist?artistId=`       | Per-artist history without paging.                               |
| `lidarr_calendar`             | `GET /calendar?start=&end=`           | Upcoming album release dates.                                    |
| `lidarr_health`               | `GET /health`                         | Surfaces indexer-down / low-disk warnings.                       |
| `lidarr_diskspace`            | `GET /diskspace`                      | Inform "where to add this artist" decisions.                     |
| `lidarr_list_quality_profiles`| `GET /qualityprofile`                 | Required prerequisite for the add-artist tool.                   |
| `lidarr_list_metadata_profiles` | `GET /metadataprofile`              | **Also** required for add-artist (Lidarr-specific).              |
| `lidarr_list_root_folders`    | `GET /rootfolder`                     | Required prerequisite for the add-artist tool.                   |
| `lidarr_list_tags`            | `GET /tag`                            | Required for any tool that scopes by tag.                        |
| `lidarr_list_indexers`        | `GET /indexer`                        | Diagnostic.                                                      |
| `lidarr_list_download_clients`| `GET /downloadclient`                 | Diagnostic.                                                      |
| `lidarr_release_search`       | `GET /release?artistId=&albumId=`     | Manual indexer search; returns candidates without grabbing.      |
| `lidarr_parse_release`        | `GET /parse?title=`                   | Sanity-check what Lidarr thinks a release name is.               |
| `lidarr_rename_preview`       | `GET /rename?artistId=&albumId=`      | "What would rename change?" without applying.                    |
| `lidarr_retag_preview`        | `GET /retag?artistId=&albumId=`       | "What audio tags would Lidarr rewrite?" without applying.        |
| `lidarr_queue_paged`          | `GET /queue` (with `page`, `pageSize`, filters) | Replaces `lidarr_queue` once paging matters.           |

## Candidate tools — write

Higher value, higher risk. Each should be added *with the prerequisite
read tool already in place* — e.g. don't ship add-artist without
list-quality-profiles + list-metadata-profiles + list-root-folders,
since the LLM has to choose ids.

| Tool name                     | Endpoint                              | Risk class | Notes                                                              |
| ----------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `lidarr_add_artist`           | `POST /artist` (body: `ArtistResource`) | Medium   | Needs `foreignArtistId`, `qualityProfileId`, `metadataProfileId`, `rootFolderPath`, `monitored`, `monitorNewItems`, `addOptions.searchForMissingAlbums`. Must come from a prior `lookup_artist` call. |
| `lidarr_add_album`            | `POST /album` (body: `AlbumResource`)   | Medium   | For adding a one-off album when you don't want the full artist back-catalogue. Must come from `lookup_album`. |
| `lidarr_edit_artist`          | `PUT /artist/{id}`                    | Medium     | Toggle monitor, change quality profile, change metadata profile, change root folder. Single-artist. |
| `lidarr_monitor_albums`       | `PUT /album/monitor` (body: `AlbumsMonitoredResource`) | Low | Bulk monitor toggle by album ids — common workflow. |
| `lidarr_search_artist`        | `POST /command` (`name: "ArtistSearch"`) | Low      | Trigger a full-artist search. Verify the exact command name against Lidarr source — the spec doesn't enumerate. |
| `lidarr_search_album`         | `POST /command` (`name: "AlbumSearch"`) | Low      | Trigger an album search.                                           |
| `lidarr_refresh_artist`       | `POST /command` (`name: "RefreshArtist"`) | Low    | Re-pull metadata from MusicBrainz.                                 |
| `lidarr_search_missing`       | `POST /command` (`name: "MissingAlbumSearch"`) | Low | Search across all monitored, missing albums.                       |
| `lidarr_rescan_artist`        | `POST /command` (`name: "RescanArtist"`) | Low      | Re-scan disk for an artist's folder.                               |
| `lidarr_get_command`          | `GET /command/{id}`                   | Low        | Companion poll for any of the above.                               |
| `lidarr_grab_release`         | `POST /release` (body: `ReleaseResource`) | High   | Grab a specific release returned by `release_search`. Defer until release_search ships. |
| `lidarr_queue_remove`         | `DELETE /queue/{id}?removeFromClient=&blocklist=` | Medium | Single item only; no bulk.                                |
| `lidarr_queue_regrab`         | `POST /queue/grab/{id}`               | Low        | Force re-grab of a stuck queue item.                               |
| `lidarr_history_mark_failed`  | `POST /history/failed/{id}`           | Medium     | Marks a history item failed → triggers re-search.                  |

## Out of scope

These are intentionally not exposed. The cost of an LLM mis-firing
is too high relative to the benefit.

| Capability                    | Endpoint(s)                                                | Why                                                                  |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete artist                 | `DELETE /artist/{id}?deleteFiles=true&addImportListExclusion=true` | Combines library removal with on-disk file deletion. LLM hallucination cost is files-gone. If we ever ship it, gate behind a confirmation flow. |
| Delete album                  | `DELETE /album/{id}`                                       | Same reasoning, finer granularity.                                   |
| Bulk artist edit/delete       | `PUT /artist/editor`, `DELETE /artist/editor`              | Same reason as delete-artist, multiplied by N.                       |
| Bulk album-studio monitor     | `POST /albumstudio`                                        | Mass monitoring change across many artists at once. Defer until we have a clear single-artist UX first. |
| Delete trackfiles             | `DELETE /trackfile/{id}`, `DELETE /trackfile/bulk`         | Removes media from disk.                                             |
| Bulk trackfile edit           | `PUT /trackfile/editor`, `PUT /trackfile/bulk`             | Multi-file mutation; rare and risky.                                 |
| Bulk queue remove             | `DELETE /queue/bulk`                                       | Single-item remove is enough; bulk multiplies risk.                  |
| Bulk queue grab               | `POST /queue/grab/bulk`                                    | Same reasoning as bulk remove.                                       |
| Generic command runner        | `POST /command` with arbitrary name                        | Specific commands are exposed individually (above) so we can scope inputs. A generic runner would let the LLM run any command. |
| Server lifecycle              | `POST /system/restart`, `POST /system/shutdown`            | Out of band — operator concern.                                      |
| Server backups                | `GET /system/backup`, `DELETE /system/backup/{id}`, `POST /system/backup/restore/*` | Operator concern.                            |
| Config writes                 | `PUT /config/*`                                            | Server settings — out of MCP scope; manage in Lidarr UI.             |
| Indexer/downloadclient/notification/metadata writes | `POST/PUT/DELETE` on these resources | Configuration. Same reasoning as config writes.            |

## Lidarr-specific gotchas

- **POST /artist requires both `qualityProfileId` AND `metadataProfileId`.**
  Sonarr/Radarr only need a single `qualityProfileId`. Lidarr's
  `metadataprofile` is a separate concept that filters by *album type*
  (Album/EP/Single, Studio/Live/Compilation/Soundtrack) and *release
  status* (Official/Promotional/Bootleg/Pseudo-Release). A user who
  picks the wrong one ends up with bootleg-flooded or
  singles-only collections. When wiring `lidarr_add_artist`, list
  both profile sets in the prompt and make the LLM choose explicitly.
- **`AddArtistOptions.monitor` controls back-catalogue monitoring.**
  Values like `all`, `future`, `missing`, `existing`, `first`, `latest`,
  `none` decide which existing albums get monitored on add. Plus there's
  a top-level `monitorNewItems` (`all|none|new`) for *future* releases.
  Two knobs, easy to confuse — surface both as explicit zod inputs.
- **Three-level hierarchy means more lookup steps.** Sonarr is
  series → episode (2 levels). Lidarr is artist → album → track (3).
  When the user asks "find this song", the LLM may need:
  artist lookup → list albums → list tracks → release search. Don't
  collapse this into a single tool — keep each step inspectable.
- **`/api/v1/search` ≠ `/api/v1/release`.** `search` is the UI's
  global "find an artist or album" box — it returns local catalogue
  matches plus MusicBrainz hints, in a `SearchResource` shape. It does
  *not* trigger an indexer search. For "find me a torrent of this", use
  `/release?artistId=&albumId=`.
- **`metadata` and `metadataprofile` are unrelated.** `metadata`
  manages metadata-file *consumers* (Kodi NFO, Plex, etc., same shape
  as Sonarr/Radarr). `metadataprofile` is the music-specific
  album-type/release-status filter described above. Don't conflate.
- **`retag` is preview-only.** `GET /retag` returns what *would*
  change in audio tags — applying the changes is a separate
  `POST /command` (likely `RetagFiles` or `RetagArtist`; verify against
  source before exposing as a tool). The preview endpoint is safe.
- **`AlbumResource.profileId` is a legacy field.** New code should
  rely on the artist's `qualityProfileId` / `metadataProfileId` and
  ignore the album's bare `profileId`. Worth flagging if we ever
  expose album-edit tools.
- **Spec metadata says `info.version: 1.0.0`.** The actual Lidarr
  version is v3.1.0.4875 (per file rename + GitHub tag). The `1.0.0`
  is the API contract version, not the app — don't be alarmed.
- **No deprecated operations in this snapshot.** Useful baseline:
  if a future spec refresh introduces deprecations, they'll be
  visible via `node -e "Object.entries(s.paths).forEach(...)"` filtering
  on `op.deprecated === true`.
- **Command names are not in the spec.** `POST /command` accepts a
  string `name` field, but the enumeration of valid names lives in
  Lidarr's source (`src/NzbDrone.Core/<feature>/<Cmd>.cs`). Verify
  exact names (`AlbumSearch`, `ArtistSearch`, `MissingAlbumSearch`,
  `RefreshArtist`, `RescanArtist`, `RetagFiles`) against the
  v3.1.0.4875 tag before shipping the command-trigger tools above.
