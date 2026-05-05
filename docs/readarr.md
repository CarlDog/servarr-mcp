# Readarr — endpoint catalogue & tool decisions

Book management. `/api/v1` (Readarr v0.4 series — `develop` is the
active line). For cross-cutting Servarr patterns (auth, paging,
command pattern, errors), see [SERVARR-API.md](SERVARR-API.md).

Spec: [`docs/specs/readarr.json`](specs/readarr.json) — pinned to
`v0.4.18.2805`. **161 paths, 233 operations, 53 top-level resources.**

This is a living document. Update when we add tools, when we hit a
gotcha, or when the spec snapshot is refreshed.

## Resource catalogue

Grouped by what they do, not by URL prefix. Each row is a Readarr
resource family — see the spec for full per-endpoint detail.

### Library — book catalogue & lookup

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `author`              | GET, POST, PUT, DELETE | Author CRUD. POST adds a new author (after lookup); DELETE on `/author/{id}` removes the author. |
| `author/lookup`       | GET                    | Goodreads-derived fuzzy search by author. Returns candidates — *not yet* in the local library. |
| `author/editor`       | PUT, DELETE            | **Bulk** edit/delete by ids array. High blast radius via LLM.        |
| `book`                | GET, POST, PUT, DELETE | Book CRUD. GET supports `?authorId=` filter. POST adds a single book. |
| `book/lookup`         | GET                    | Fuzzy search by book title (independent of an author). Returns candidates. |
| `book/{id}/overview`  | GET                    | Long-form description for a book — separate from the row data.       |
| `book/monitor`        | PUT                    | Bulk monitor toggle for a list of book ids (`BooksMonitoredResource`). |
| `book/editor`         | PUT, DELETE            | **Bulk** book edit/delete. High blast radius.                        |
| `edition`             | GET                    | Editions of a book — `GET /edition?bookId=`. Hardcover / paperback / ebook / audiobook variants. Read-only over HTTP. |
| `bookfile`            | GET, PUT, DELETE       | The actual file rows behind books. `DELETE /bookfile/{id}` removes the file from disk; `DELETE /bookfile/bulk` is the bulk variant. |
| `bookshelf`           | POST                   | Bulk-set monitoring across a set of authors and their books in one shot — see gotchas. |
| `series`              | GET                    | **Book** series (e.g. "Wheel of Time", "The Expanse") — *not* TV series. Read-only; `?authorId=` filter. See gotchas. |
| `search`              | GET                    | Combined author+book search, `?term=`. Convenience wrapper over the two `/lookup` endpoints. |

### Status — what's downloading, what's missing, what happened

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `queue`               | GET, DELETE            | Active downloads (paged). `DELETE /queue/{id}?removeFromClient=true&blocklist=true` removes from queue and optionally from the download client + blocklists. `DELETE /queue/bulk` is the bulk variant. |
| `queue/grab/{id}`     | POST                   | Force-grab a queue item that's stuck. `queue/grab/bulk` for many.    |
| `queue/details`       | GET                    | Per-item details enriched with author/book info.                     |
| `queue/status`        | GET                    | Aggregated queue counts (downloading/queued/warning).                |
| `history`             | GET                    | Paged history (newest first). Filters: `eventType`, `bookId`, etc.   |
| `history/since`       | GET                    | History from a given timestamp — useful for incremental polling.     |
| `history/author`      | GET                    | Per-author history — bypasses paging.                                |
| `history/failed/{id}` | POST                   | Mark a history item as failed → triggers re-search.                  |
| `wanted/missing`      | GET                    | Books wanted but not yet downloaded (paged). `?includeAuthor=&monitored=`. |
| `wanted/cutoff`       | GET                    | Books downloaded but below cutoff quality (upgrade candidates).      |
| `calendar`            | GET                    | Book release calendar across monitored authors. `?start=&end=&unmonitored=&includeAuthor=`. Also exposed as an iCal feed at `/feed/v1/calendar/readarr.ics`. |
| `blocklist`           | GET, DELETE            | Releases that have been blocked from re-grab.                        |

### Releases & search (the actual download trigger surface)

| Resource              | Verbs                  | Purpose                                                              |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `release`             | GET, POST              | `GET /release?bookId=&authorId=` runs a manual indexer search and returns candidate releases. `POST /release` grabs a specific release (the canonical "click download" action). |
| `release/push`        | POST                   | Submit an arbitrary release URL — power-user flow.                   |
| `manualimport`        | GET, POST              | Stage and commit manual imports for files Readarr didn't grab.       |
| `parse`               | GET                    | Run a release name through Readarr's parser without grabbing.        |
| `command`             | GET, POST, DELETE      | Async action trigger. See [SERVARR-API.md § Commands](SERVARR-API.md#commands-async-actions). |

### Configuration (server settings)

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `qualityprofile`      | List/CRUD quality profiles. Required input for adding an author (POST /author body needs `qualityProfileId`). |
| `qualitydefinition`   | Per-quality min/max size. Power-user.                                      |
| `metadataprofile`     | Readarr-specific (also in Lidarr). Controls which editions/books from an author qualify — `minPopularity`, `skipMissingDate`, `skipMissingIsbn`, `skipPartsAndSets`, `allowedLanguages`, `minPages`. Required for POST /author. |
| `customformat`        | Custom formats for fine-grained release scoring.                           |
| `releaseprofile`      | Required/preferred/ignored words for release filtering.                    |
| `delayprofile`        | Hold a release for N minutes to allow a better one to land.                |
| `customfilter`        | Saved filter expressions for the UI.                                       |
| `tag`                 | Generic tag CRUD plus `/tag/detail` for usage counts. Used for grouping authors, scoping notifications, etc. |
| `rootfolder`          | List of paths Readarr will create author folders under. Required for POST /author. |
| `remotepathmapping`   | Translate paths between download client and Readarr.                       |
| `importlist` / `importlistexclusion` | Sources of authors/books to auto-import (Goodreads lists, etc.) and exclusions. |
| `indexer` / `indexerflag` | Indexer connection management (also: `/test`, `/testall`, `/action/{name}`, `/schema`). |
| `downloadclient`      | Download client management (same shape as indexer).                        |
| `notification`        | Notification provider management (same shape).                             |
| `metadata`            | Metadata-file consumer management (same shape).                            |
| `config/*`            | Server-level config sections (host, mediamanagement, naming, ui, downloadclient, importlist, indexer, metadataprovider, etc. — 17 endpoints). PUT-able. |

### System / diagnostic

| Resource              | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `system/status`       | Version, branch, runtime info — used by `health` checks.                   |
| `system/task`         | Scheduled tasks (housekeeping, RSS sync, etc.).                            |
| `system/backup`       | Backup CRUD — server admin.                                                |
| `system/restart`, `system/shutdown` | Server lifecycle. **Don't expose via MCP.**                  |
| `health`              | Aggregated health warnings (indexer down, low disk, etc.).                 |
| `diskspace`           | Per-mount free/total space. Useful before adding an author.                |
| `update`              | Available app updates.                                                     |
| `log` / `log/file`    | Server logs. Diagnostic.                                                   |
| `localization`        | UI string tables. Not useful for MCP tools.                                |
| `mediacover`          | Author/book covers — `/mediacover/author/{authorId}/{filename}`, `/mediacover/book/{bookId}/{filename}`. Image bytes, not JSON. |
| `filesystem`          | Path browser used by the UI when picking root folders.                     |
| `rename`              | Preview rename results for current naming config (`?authorId=&bookId=`).   |
| `retag`               | Preview audio-file tag changes (`?authorId=&bookId=`). Read-only preview; the actual retag runs via a `command`. |

## Currently exposed tools

| Tool                  | Endpoint                            | Notes                              |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `readarr_list_authors`| `GET /author`                       | All authors, no filter.            |
| `readarr_get_author`  | `GET /author/{id}`                  |                                    |
| `readarr_lookup_author`| `GET /author/lookup?term=`         | Fuzzy match for new adds.          |
| `readarr_list_books`  | `GET /book` (with optional `authorId`) | All books, optionally scoped to one author. |
| `readarr_queue`       | `GET /queue`                        | Inherited from `ServarrClient.queue()`. No paging exposed yet — needs `page`/`pageSize` inputs when the queue grows. |
| `readarr_history`     | `GET /history?pageSize=&sortKey=date&sortDirection=descending` | Inherited from base; only `page_size` exposed. |

## Candidate tools — read

Quick wins. Most are one-line additions over the existing client.

| Tool name                  | Endpoint                              | Why                                                              |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `readarr_get_book`         | `GET /book/{id}`                      | Drill-down for a single book.                                    |
| `readarr_book_overview`    | `GET /book/{id}/overview`             | Long-form description, separate from row data.                   |
| `readarr_lookup_book`      | `GET /book/lookup?term=`              | Fuzzy match on book title (no author needed) for new adds.       |
| `readarr_search`           | `GET /search?term=`                   | Combined author+book search — convenience over two lookups.      |
| `readarr_list_editions`    | `GET /edition?bookId=`                | List hardcover/paperback/ebook/audiobook variants for a book.    |
| `readarr_list_book_series` | `GET /series?authorId=`               | Book series (saga groupings) for an author. **Not TV series.**   |
| `readarr_wanted_missing`   | `GET /wanted/missing` (paged)         | "What books am I missing?" — top-tier user query.                |
| `readarr_wanted_cutoff`    | `GET /wanted/cutoff` (paged)          | Upgrade candidates.                                              |
| `readarr_history_author`   | `GET /history/author?authorId=`       | Per-author history without paging.                               |
| `readarr_calendar`         | `GET /calendar?start=&end=`           | ISO date window of upcoming/past book releases.                  |
| `readarr_health`           | `GET /health`                         | Surfaces indexer-down / low-disk warnings.                       |
| `readarr_diskspace`        | `GET /diskspace`                      | Inform "where to add this author" decisions.                     |
| `readarr_list_quality_profiles` | `GET /qualityprofile`            | Required prerequisite for the add-author tool.                   |
| `readarr_list_metadata_profiles`| `GET /metadataprofile`           | Required prerequisite for the add-author tool.                   |
| `readarr_list_root_folders`| `GET /rootfolder`                     | Required prerequisite for the add-author tool.                   |
| `readarr_list_tags`        | `GET /tag`                            | Required for any tool that scopes by tag.                        |
| `readarr_list_indexers`    | `GET /indexer`                        | Diagnostic.                                                      |
| `readarr_list_download_clients` | `GET /downloadclient`            | Diagnostic.                                                      |
| `readarr_release_search`   | `GET /release?bookId=&authorId=`      | Manual indexer search; returns candidates without grabbing.      |
| `readarr_parse_release`    | `GET /parse?title=`                   | Sanity-check what Readarr thinks a release name is.              |
| `readarr_retag_preview`    | `GET /retag?authorId=&bookId=`        | Preview tag changes that a retag command would apply.            |
| `readarr_queue_paged`      | `GET /queue` (with `page`, `pageSize`, filters) | Replaces `readarr_queue` once paging matters.          |

## Candidate tools — write

Higher value, higher risk. Each should be added *with the prerequisite
read tool already in place* — e.g. don't ship add-author without
list-quality-profiles + list-metadata-profiles + list-root-folders,
since the LLM has to choose ids.

| Tool name                  | Endpoint                              | Risk class | Notes                                                              |
| -------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `readarr_add_author`       | `POST /author` (body: `AuthorResource`) | Medium   | Needs `foreignAuthorId`, `qualityProfileId`, `metadataProfileId`, `rootFolderPath`, `monitored`, `addOptions.searchForMissingBooks`, `addOptions.monitor`. Must come from a prior `lookup_author`. |
| `readarr_edit_author`      | `PUT /author/{id}`                    | Medium     | Toggle monitor, change quality/metadata profile, change root folder. Single-author. |
| `readarr_add_book`         | `POST /book` (body: `BookResource`)   | Medium     | For adding individual books outside the author-add flow. `addOptions.addType: automatic|manual`, `searchForNewBook: bool`. |
| `readarr_monitor_books`    | `PUT /book/monitor` (body: `BooksMonitoredResource`) | Low | Bulk monitor toggle by book ids — common workflow ("monitor these three books from this author"). |
| `readarr_search_book`      | `POST /command` (`name: "BookSearch"`)   | Low      | Trigger a book search.                                             |
| `readarr_search_author`    | `POST /command` (`name: "AuthorSearch"`) | Low      | Trigger a full-author search.                                      |
| `readarr_search_missing`   | `POST /command` (`name: "MissingBookSearch"`) | Low | Search across all monitored, missing books.                        |
| `readarr_refresh_author`   | `POST /command` (`name: "RefreshAuthor"`) | Low     | Re-pull metadata for an author.                                    |
| `readarr_get_command`      | `GET /command/{id}`                   | Low        | Companion poll for any of the above. The four command names above (`BookSearch`, `AuthorSearch`, `MissingBookSearch`, `RefreshAuthor`) are verified live; the spec doesn't enumerate command names so any new ones added here should be confirmed by test call. |
| `readarr_grab_release`     | `POST /release` (body: `ReleaseResource`) | High   | Grab a specific release returned by `release_search`. Defer until release_search ships. |
| `readarr_queue_remove`     | `DELETE /queue/{id}?removeFromClient=&blocklist=` | Medium | Single item only; no bulk.                                |
| `readarr_queue_regrab`     | `POST /queue/grab/{id}`               | Low        | Force re-grab of a stuck queue item.                               |
| `readarr_history_mark_failed` | `POST /history/failed/{id}`        | Medium     | Marks a history item failed → triggers re-search.                  |

## Out of scope

These are intentionally not exposed. The cost of an LLM mis-firing
is too high relative to the benefit.

| Capability                    | Endpoint(s)                                                | Why                                                                  |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete author                 | `DELETE /author/{id}?deleteFiles=true`                     | Combines library removal with on-disk file deletion. LLM hallucination cost is files-gone. If we ever ship it, gate behind a confirmation flow. |
| Bulk author edit/delete       | `PUT /author/editor`, `DELETE /author/editor`              | Same reason, multiplied by N.                                        |
| Bulk book edit/delete         | `PUT /book/editor`, `DELETE /book/editor`                  | Same reason, multiplied by N.                                        |
| Delete book files             | `DELETE /bookfile/{id}`, `DELETE /bookfile/bulk`           | Removes media from disk.                                             |
| Bulk queue remove             | `DELETE /queue/bulk`, `POST /queue/grab/bulk`              | Single-item variants are exposed individually with explicit flags.   |
| Bookshelf bulk monitor toggle | `POST /bookshelf`                                          | Cross-author bulk-monitor with no per-row confirmation. See gotchas. |
| Generic command runner        | `POST /command` with arbitrary name                        | Specific commands are exposed individually (above) so we can scope inputs. A generic runner would let the LLM run any command. |
| Server lifecycle              | `POST /system/restart`, `POST /system/shutdown`            | Out of band — operator concern.                                      |
| Server backups                | `GET /system/backup`, `DELETE /system/backup/{id}`, `POST /system/backup/restore/*` | Operator concern.                            |
| Config writes                 | `PUT /config/*`                                            | Server settings — out of MCP scope; manage in Readarr UI.            |
| Indexer/downloadclient/notification/metadata writes | `POST/PUT/DELETE` on these resources | Configuration. Same reasoning as config writes.            |

## Readarr-specific gotchas

- **`series` means *book* series.** `GET /api/v1/series` returns book
  series (e.g. "Wheel of Time", "The Expanse", "Discworld") — saga
  groupings of books by an author. It is **not** a TV series and has
  no relation to Sonarr's `series` resource. An LLM that has seen the
  Sonarr surface will assume otherwise — name the tool
  `readarr_list_book_series` (not `readarr_list_series`) and document
  the distinction in the tool description. The resource is read-only
  (`GET` with `?authorId=`) and links books via `SeriesBookLinkResource`
  (book id + position string + numeric series position).
- **Hierarchy is `author → book → edition`, not just `author → book`.**
  Each book has an array of editions (hardcover, paperback, ebook,
  audiobook). `BookResource.foreignEditionId` plus
  `anyEditionOk: bool` decides whether Readarr will accept any
  edition or only the chosen one. `GET /edition?bookId=` lists them.
  When wiring add-book or edit-book tools, this is the field LLMs
  most commonly miss.
- **`metadataprofile` is mandatory and distinct from `qualityprofile`**
  (same as Lidarr). It controls *which books* from an author qualify
  (`minPopularity`, `skipMissingDate`, `skipMissingIsbn`,
  `skipPartsAndSets`, `allowedLanguages`, `minPages`). `qualityprofile`
  controls *which file qualities* qualify. POST `/author` requires
  both ids — list both before adding.
- **Two lookup endpoints, plus a combined search.** `/author/lookup`
  returns authors; `/book/lookup` returns books (independent of
  author); `/search` is a combined convenience wrapper. Pick the
  narrowest for the use case — `book/lookup` is the right call when
  the user asks "is *Project Hail Mary* in the catalogue?" because it
  matches on title.
- **`POST /bookshelf` is a multi-author bulk monitor toggle.** The
  body (`BookshelfResource`) carries an array of authors, each with
  their own `monitored` flag and an array of books with per-book
  monitor flags, plus a top-level `monitoringOptions` /
  `monitorNewItems` (`all` | `none` | `new`). It's the UI's
  "select-many, set-monitor" surface in one shot — powerful and easy
  for an LLM to mis-fire across an entire library. Listed in
  out-of-scope above; prefer the narrower `PUT /book/monitor` for
  per-book toggles.
- **`PUT /author/{id}` requires the full `AuthorResource` payload.**
  Partial updates aren't supported — fetch the existing author with
  `GET /author/{id}`, mutate the field(s), PUT the whole thing back.
  Easy LLM trap: send a sparse object → 400.
- **`retag` is preview-only over HTTP.** `GET /retag?authorId=&bookId=`
  returns the *changes that would apply* (`TagDifference[]`). The
  actual retag runs as a `command` (not a PUT). Don't expose a
  "retag" write tool that hits `/retag` — it's read-only.
- **`AddAuthorOptions.monitor` controls more than `monitored: bool`.**
  It's a `MonitorTypes` enum that combines with `booksToMonitor: string[]`
  to decide which of an author's existing books get monitored on add
  (e.g. only future books, only books since a given title, all, none).
  Defaults may not match user intent — make these explicit zod inputs
  with descriptions, not silent defaults.
- **Queue removal flags are cross-cutting.** See
  [SERVARR-API.md § DELETE /queue/{id} flags](SERVARR-API.md#delete-queueid-flags-are-identical-across-the-4-media-apps) —
  Readarr's flags are identical to Sonarr's, Radarr's, and Lidarr's
  (verified in the spec snapshots).
- **No deprecated endpoints in v0.4.18.2805.** The spec snapshot has
  zero ops marked `deprecated: true`. Readarr's upstream maintenance
  cadence has historically been intermittent, and the active line is
  `develop` — re-check this on every spec refresh.
