# Prowlarr — endpoint catalogue & tool decisions

Indexer manager. `/api/v1` (Prowlarr v2 series). For cross-cutting Servarr
patterns (auth, paging, command pattern, errors), see
[SERVARR-API.md](SERVARR-API.md).

Spec: [`docs/specs/prowlarr.json`](specs/prowlarr.json) — pinned to
`v2.3.5.5327`. **93 paths, 128 operations, 20 top-level resources.**

This is a living document. Update when we add tools, when we hit a
gotcha, or when the spec snapshot is refreshed.

## Resource catalogue

Grouped by what they do, not by URL prefix. Prowlarr is structurally
different from the four media apps: it has no library (no series, movies,
albums, or books) and no queue, because it's an indexer broker, not a
download manager. The buckets reflect that.

### Indexers — the core Prowlarr concern

| Resource                       | Verbs                  | Purpose                                                              |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| `indexer`                      | GET, POST, PUT, DELETE | Indexer CRUD. Plus `/test`, `/testall`, `/action/{name}`, `/schema` (definition templates), and `/bulk` (PUT/DELETE) for batched edits. |
| `indexer/{id}/newznab`         | GET                    | Proxy a Newznab/Torznab query straight at one indexer. Many params (`t`, `q`, `cat`, `imdbid`, `tmdbid`, `tvdbid`, etc.) — this is the wire-protocol surface clients use. |
| `indexer/{id}/download`        | GET                    | Fetch the actual `.torrent` / `.nzb` for a release through Prowlarr's proxy. |
| `indexer/categories`           | GET                    | Newznab category tree (movies/2000, TV/5000, etc.). Useful pre-filter for `search`. |
| `indexerproxy`                 | GET, POST, PUT, DELETE | HTTP proxies (FlareSolverr, raw HTTP) that indexers can route through. Also `/test`, `/testall`, `/action/{name}`, `/schema`. |
| `indexerstatus`                | GET                    | Per-indexer current health: last error, disabled-until timestamp.    |
| `indexerstats`                 | GET                    | Per-indexer aggregate counts: queries, grabs, failures, response time. |

### Applications — who consumes Prowlarr

The thing that makes Prowlarr Prowlarr. These are *outbound* connections
to Sonarr/Radarr/Lidarr/Readarr that Prowlarr pushes its indexer config
into. Sync direction is the opposite of what you'd guess.

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `applications`        | GET, POST, PUT, DELETE | Application CRUD. Same shape as indexer/notification/etc. — `/test`, `/testall`, `/action/{name}`, `/schema`, `/bulk`. |
| `appprofile`          | GET, POST, PUT, DELETE | Per-app sync profiles — controls which indexer subset gets pushed to which app. Has `/schema`. |

### Search & history

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `search`              | GET, POST              | `GET /search?query=&type=&indexerIds=&categories=&limit=&offset=` runs a search across indexers, returning `ReleaseResource[]`. `POST /search` accepts a `ReleaseResource` body — the "grab this release" action (downloads via the originating indexer and hands off to apps). |
| `search/bulk`         | POST                   | Batched release grab — accepts an array of release identifiers.       |
| `history`             | GET                    | Paged history (`page`, `pageSize`, `sortKey`, `sortDirection`). Filters: `eventType[]`, `successful`, `downloadId`, `indexerIds[]`. |
| `history/since`       | GET                    | History from a given timestamp — incremental polling.                |
| `history/indexer`     | GET                    | Per-indexer history with `eventType` + `limit`. Bypasses paging.     |

### Configuration

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `tag`                 | Generic tag CRUD. Plus `/tag/detail` and `/tag/detail/{id}` for tag-usage breakdowns. |
| `customfilter`        | Saved filter expressions for the UI.                                        |
| `notification`        | Notification provider CRUD. Same shape as indexer (`/test`, `/testall`, `/action/{name}`, `/schema`). |
| `downloadclient`      | Download client CRUD. Note: Prowlarr knows about download clients only so it can hand grabs off; it doesn't track downloads itself. Same shape as indexer. |
| `config/host`         | Server bind address, URL base, SSL.                                         |
| `config/ui`           | UI preferences.                                                             |
| `config/downloadclient` | Server-level download client config (NOT the per-client list above).      |
| `config/development`  | Diagnostic/dev toggles.                                                     |
| `command`             | Async action trigger. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions). |

### System / diagnostic

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `system/status`       | Version, branch, runtime info. Used by `health` checks.                     |
| `system/task`         | Scheduled tasks (RSS sync, app sync, housekeeping).                         |
| `system/backup`       | Backup CRUD — server admin.                                                |
| `system/restart`, `system/shutdown` | Server lifecycle. **Don't expose via MCP.**                  |
| `system/routes`       | Route enumeration — diagnostic only.                                        |
| `health`              | Aggregated health warnings (indexer down, proxy unreachable, etc.).         |
| `update`              | Available app updates.                                                      |
| `log` / `log/file`    | Server logs (and update logs). Diagnostic.                                  |
| `localization`        | UI string tables. Not useful for MCP tools.                                |
| `filesystem`          | Path browser — used by the UI for backup paths, etc.                        |

## Currently exposed tools

| Tool                       | Endpoint                            | Notes                                                       |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `prowlarr_list_indexers`   | `GET /indexer`                      | All configured indexers, no filter.                         |
| `prowlarr_indexer_stats`   | `GET /indexerstats`                 | Per-indexer aggregate counts.                               |
| `prowlarr_search`          | `GET /search?query=&indexerIds=&categories=` | Cross-indexer release search. `limit`/`offset` not exposed yet. |
| `prowlarr_history`         | `GET /history?pageSize=&sortKey=date&sortDirection=descending` | Inherited from base; only `page_size` exposed. |

## Candidate tools — read

Quick wins. Most are one-line additions over the existing client.

| Tool name                       | Endpoint                              | Why                                                              |
| ------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `prowlarr_get_indexer`          | `GET /indexer/{id}`                   | Drill-down for a single indexer.                                 |
| `prowlarr_indexer_categories`   | `GET /indexer/categories`             | Newznab category tree — prerequisite for filtered searches.      |
| `prowlarr_indexer_status`       | `GET /indexerstatus`                  | "Which indexers are currently failing and why?"                  |
| `prowlarr_health`               | `GET /health`                         | Surfaces indexer-down / proxy-unreachable warnings.              |
| `prowlarr_list_applications`    | `GET /applications`                   | The Sonarr/Radarr/etc. consumers Prowlarr is configured to sync to. |
| `prowlarr_list_app_profiles`    | `GET /appprofile`                     | Per-app sync profiles.                                           |
| `prowlarr_list_indexer_proxies` | `GET /indexerproxy`                   | Configured HTTP proxies.                                         |
| `prowlarr_list_download_clients`| `GET /downloadclient`                 | Diagnostic.                                                      |
| `prowlarr_list_notifications`   | `GET /notification`                   | Diagnostic.                                                      |
| `prowlarr_list_tags`            | `GET /tag`                            | Required for any tool that scopes by tag.                        |
| `prowlarr_history_indexer`      | `GET /history/indexer?indexerId=`     | Per-indexer history without paging.                              |
| `prowlarr_search_paged`         | `GET /search` (with `limit`, `offset`, `type`) | Replaces `prowlarr_search` once result volume matters.       |

## Candidate tools — write

Higher value, higher risk. Each should be added *with the prerequisite
read tool already in place* — e.g. don't ship `grab_release` without
`search_paged` returning real release identifiers for the LLM to pass.

| Tool name                  | Endpoint                                  | Risk class | Notes                                                              |
| -------------------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `prowlarr_grab_release`    | `POST /search` (body: `ReleaseResource`)  | High       | The "click download" action. Must come from a prior `search` result — the body is one of the items in that array. Hands the release off to the originating app's download client. |
| `prowlarr_test_indexer`    | `POST /indexer/test` (body: `IndexerResource`) | Low   | Test an indexer's connection without saving. Useful for diagnosing config drift. |
| `prowlarr_test_all_indexers` | `POST /indexer/testall`                 | Low        | Test every configured indexer.                                     |
| `prowlarr_test_application`| `POST /applications/test`                 | Low        | Same idea for an app connection.                                   |
| `prowlarr_search_indexers` | `POST /command` (`name: "IndexerSearch"`) | Low        | Trigger a backend indexer search (vs the synchronous `/search` endpoint). Verify the exact command name from source — see gotchas. |
| `prowlarr_refresh_indexer` | `POST /command` (`name: "RefreshIndexer"`)| Low        | Re-pull capability metadata for an indexer. *Verify command name from source.* |
| `prowlarr_rss_sync`        | `POST /command` (`name: "RssSync"`)       | Low        | Force RSS sync across indexers. *Verify command name from source.* |
| `prowlarr_app_check_update`| `POST /command` (`name: "ApplicationCheckUpdate"`) | Low | Trigger sync to consumer apps. *Verify command name from source.* |
| `prowlarr_get_command`     | `GET /command/{id}`                       | Low        | Companion poll for any of the above.                               |

## Out of scope

These are intentionally not exposed. The cost of an LLM mis-firing
is too high relative to the benefit.

| Capability                    | Endpoint(s)                                                | Why                                                                  |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete indexer                | `DELETE /indexer/{id}`                                     | Removing an indexer reshapes everything downstream — Prowlarr stops syncing it to apps, history is orphaned. Surface only behind a confirmation flow. |
| Bulk indexer edit/delete      | `PUT /indexer/bulk`, `DELETE /indexer/bulk`                | Same reason, multiplied by N.                                        |
| Application/proxy/notification/downloadclient writes | `POST/PUT/DELETE` on `applications`, `indexerproxy`, `notification`, `downloadclient` | Connection management — out of MCP scope; manage in Prowlarr UI. |
| Generic command runner        | `POST /command` with arbitrary name                        | Specific commands are exposed individually (above) so we can scope inputs. A generic runner would let the LLM run any command. |
| Server lifecycle              | `POST /system/restart`, `POST /system/shutdown`            | Out of band — operator concern.                                      |
| Server backups                | `GET /system/backup`, `DELETE /system/backup/{id}`, `POST /system/backup/restore/*` | Operator concern.                            |
| Config writes                 | `PUT /config/*`                                            | Server settings — out of MCP scope; manage in Prowlarr UI.           |

## Prowlarr-specific gotchas

- **No media library.** Prowlarr has no `series`, `movie`, `album`,
  `book`, or `author` resources — and no `lookup` endpoint. It doesn't
  manage media, only indexers. Don't try to share add-media or
  library-listing tool shapes with the four media apps.
- **No `/queue` endpoint.** Verified absent from the spec. Prowlarr is a
  search proxy, not a download manager — once a release is grabbed it's
  the consuming app's queue (Sonarr/Radarr/etc.) that tracks it.
  `ServarrClient.queue()` is inherited but **calling it against Prowlarr
  will 404**. Don't expose `prowlarr_queue` and don't reach for the
  base method.
- **No media-management resources, period.** `blocklist`, `calendar`,
  `customformat`, `delayprofile`, `importlist`, `importlistexclusion`,
  `indexerflag`, `language`, `languageprofile`, `manualimport`,
  `mediacover`, `metadata`, `parse`, `qualitydefinition`,
  `qualityprofile`, `release`, `releaseprofile`, `remotepathmapping`,
  `rename`, `rootfolder`, `wanted` — none exist. Resources that look
  similar at first glance (`search`, `applications`) play different
  roles. Don't pattern-match shapes from Sonarr.
- **`applications` is outbound, not inbound.** "Application" in
  Prowlarr means a Sonarr/Radarr/Lidarr/Readarr instance that Prowlarr
  *pushes config into*. Not a Prowlarr API consumer. The sync direction
  trips up everyone the first time.
- **`POST /search` is the grab action; `GET /search` is the query
  action.** Same path, opposite intent. The `POST` body is a
  `ReleaseResource` — must be one of the entries returned by a prior
  `GET /search`, with its `guid` and `indexerId` intact. An LLM
  composing the body from scratch will fail.
- **Newznab pass-through endpoint.** `GET /indexer/{id}/newznab`
  proxies a raw Newznab/Torznab query at a single indexer. The
  parameter set (`t`, `q`, `cat`, `imdbid`, `tmdbid`, `tvdbid`,
  `tvmazeid`, `traktid`, `rid`, `doubanid`, `extended`, `minage`,
  `maxage`, `minsize`, `maxsize`, `limit`, `offset`) is the Newznab
  spec, not Prowlarr's invention. If we ever expose this, the input
  schema needs to mirror Newznab — don't try to "tidy" it.
- **Command names not enumerated in the spec.** `POST /command` accepts
  a `CommandResource` whose `name` field is a free-form string. Likely
  candidates are `IndexerSearch`, `RefreshIndexer`, `RssSync`,
  `ApplicationCheckUpdate` — but verify against
  `src/NzbDrone.Core/**/*.cs` in the Prowlarr repo before wiring tools.
  See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions).
- **Indexer schema is huge.** `GET /indexer/schema` returns the full
  catalogue of indexer definitions Prowlarr knows how to instantiate
  (hundreds of entries). Don't paste raw schema output into LLM
  context — surface a filtered/summarised view if we ever expose it.
