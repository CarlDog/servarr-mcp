# Servarr APIs — cross-cutting reference

The five Servarr-team apps (Sonarr, Radarr, Lidarr, Readarr,
Prowlarr) share a common ASP.NET-based API surface with a lot of
structural overlap and a few app-specific divergences. This file is
the cross-cutting reference: things that apply to all of them. For
per-app endpoint catalogues and tool decisions, see the per-app
docs linked at the bottom.

This is a living document. When you discover a new quirk, add it
here. When the quirk is app-specific, add it to the per-app doc
instead.

## External references

- **Per-app GitHub repos** — the OpenAPI spec is committed in each:
  - [Sonarr](https://github.com/Sonarr/Sonarr) — `src/Sonarr.Api.V3/openapi.json`
  - [Radarr](https://github.com/Radarr/Radarr) — `src/Radarr.Api.V3/openapi.json`
  - [Lidarr](https://github.com/Lidarr/Lidarr) — `src/Lidarr.Api.V1/openapi.json`
  - [Readarr](https://github.com/Readarr/Readarr) — `src/Readarr.Api.V1/openapi.json`
  - [Prowlarr](https://github.com/Prowlarr/Prowlarr) — `src/Prowlarr.Api.V1/openapi.json`
- **Servarr Wiki** — [wiki.servarr.com](https://wiki.servarr.com/) —
  per-app user docs, occasionally helpful for explaining the *intent*
  of a resource (e.g. "what is a delay profile?") that the spec
  doesn't capture.
- **Discord** — Servarr-team apps have a shared Discord; not linked
  here, but it's the only "support" channel for undocumented behavior.

## Spec snapshots

Live `/swagger/v3/swagger.json` is **disabled by default in shipping
builds** (returns 401 with or without `X-Api-Key`). Specs in
`docs/specs/` are version-pinned to the installed deploy target, not
the latest `develop` branch:

| App      | File                       | Installed version | Tag                                                                                                | Ops |
| -------- | -------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- | --- |
| Sonarr   | `docs/specs/sonarr.json`   | v4.0.17.2952      | [v4.0.17.2952](https://github.com/Sonarr/Sonarr/blob/v4.0.17.2952/src/Sonarr.Api.V3/openapi.json) | 234 |
| Radarr   | `docs/specs/radarr.json`   | v6.1.1.10360      | [v6.1.1.10360](https://github.com/Radarr/Radarr/blob/v6.1.1.10360/src/Radarr.Api.V3/openapi.json) | 237 |
| Lidarr   | `docs/specs/lidarr.json`   | v3.1.0.4875       | [v3.1.0.4875](https://github.com/Lidarr/Lidarr/blob/v3.1.0.4875/src/Lidarr.Api.V1/openapi.json)   | 235 |
| Readarr  | `docs/specs/readarr.json`  | v0.4.18.2805      | [v0.4.18.2805](https://github.com/Readarr/Readarr/blob/v0.4.18.2805/src/Readarr.Api.V1/openapi.json) | 233 |
| Prowlarr | `docs/specs/prowlarr.json` | v2.3.5.5327       | [v2.3.5.5327](https://github.com/Prowlarr/Prowlarr/blob/v2.3.5.5327/src/Prowlarr.Api.V1/openapi.json) | 128 |

**Refresh process** when the deploy target upgrades:

1. Get the new version from `GET /api/vN/system/status` (`appName`,
   `version`).
2. `curl -L -o docs/specs/<app>.json https://raw.githubusercontent.com/<Org>/<App>/v<version>/src/<App>.Api.V<n>/openapi.json`
3. `git diff` shows what changed; update the per-app doc accordingly.
4. The `.gitattributes` rule pins these files to LF on checkout so
   refreshes don't show CRLF/LF noise.

## Authentication

All five apps use the same scheme (verified — identical
`securitySchemes` block across all spec files):

- **`X-Api-Key: <key>` HTTP header** — preferred, what we use.
- `?apikey=<key>` query string — also accepted, **don't use**: leaks
  into access logs and reverse-proxy logs. Header-only.

Each app has its own key, generated on first run and visible in
`Settings → General → Security` in the app's web UI. Rotating a key
requires editing `config.xml` and restarting the app.

## API versioning

| App             | Path prefix |
| --------------- | ----------- |
| Sonarr, Radarr  | `/api/v3`   |
| Lidarr, Readarr, Prowlarr | `/api/v1` |

Sonarr/Radarr v3 is the current major; v2 was deprecated long ago.
Lidarr v2 is on the upstream roadmap and will likely change the
prefix when it lands — `ServarrClient` subclasses set their own
`apiPath` so a future bump is local to the subclass.

There's also a (rarely used) `/api` legacy prefix on some endpoints
that bypasses auth for things like `/ping`. Don't rely on it.

## Cross-cutting patterns

### Pagination

Paged endpoints (history, blocklist, queue, log, episodes for Sonarr,
etc.) use a uniform shape:

**Request query params:** `page` (default 1), `pageSize` (default 10),
`sortKey`, `sortDirection` (`ascending`/`descending`).

**Response:**

```json
{
  "page": 1,
  "pageSize": 10,
  "sortKey": "date",
  "sortDirection": "descending",
  "totalRecords": 1234,
  "records": [...]
}
```

The schema component is named `<Resource>PagingResource` (e.g.
`HistoryResourcePagingResource`). When wrapping a paged endpoint as
an MCP tool, expose `page` and `pageSize` as zod inputs with sane
defaults — don't make the LLM guess.

### Lookup (add new media)

Each media app exposes `<noun>/lookup?term=...` for fuzzy external
search before adding:

| App     | Endpoint(s)                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| Sonarr  | `GET /api/v3/series/lookup?term=...`                                              |
| Radarr  | `GET /api/v3/movie/lookup?term=...` (also `/movie/lookup/tmdb`, `/movie/lookup/imdb`) |
| Lidarr  | `GET /api/v1/artist/lookup?term=...`, `GET /api/v1/album/lookup?term=...`         |
| Readarr | `GET /api/v1/author/lookup?term=...`, `GET /api/v1/book/lookup?term=...`          |

Returns matching candidates from the upstream metadata source (TVDB,
TMDb, MusicBrainz, Goodreads/Kavita). The result is *not yet* in the
local library — it's a candidate. Adding a movie/series is a
separate `POST /<noun>` with the chosen lookup result + a quality
profile + a root folder.

Prowlarr has no lookup — it doesn't manage media.

### Commands (async actions)

Anything that triggers work — search a series, refresh metadata, scan
a folder, run a custom script — goes through the `command` resource:

- `POST /api/vN/command` with `{ "name": "<CommandName>", ...args }`
  → returns a `CommandResource` with `id`, `status: "queued"`.
- `GET /api/vN/command/{id}` → poll for `status: completed | failed`.
- `GET /api/vN/command` → list all running/recent commands.
- `DELETE /api/vN/command/{id}` → cancel a queued/running command.

Command names are CamelCase strings tied to the app's internal
command handlers. Common ones (Sonarr): `RefreshSeries`,
`EpisodeSearch`, `MissingEpisodeSearch`, `SeriesSearch`, `RescanSeries`,
`Backup`. The spec does **not** enumerate them — they're discoverable
by reading the source (`src/NzbDrone.Core/<feature>/<Cmd>.cs` in each
repo). When we add command-trigger tools, the per-app doc must list
the commands we're exposing and what they do.

Commands are async. A search command returning `id=42, status=queued`
doesn't mean grabs happened — that comes via the queue/history
later. Don't have tools wait synchronously; return the command id
and let a follow-up tool check status.

### Tags

All five apps share a generic `/tag` resource — integer-id'd tags
that can be attached to many resources (series, movies, indexers,
download clients, notifications). When wiring tools that filter by
tag, accept tag *labels* in the input and translate to ids
internally — labels are stable, ids aren't.

### Resources shared across all 5 apps

The OpenAPI specs reveal a near-identical chassis. These resources
exist in every app (Prowlarr trims the media-management ones):

`blocklist`, `command`, `config`, `customfilter`, `downloadclient`,
`filesystem`, `health`, `history`, `importlist`, `indexer`,
`indexerflag`, `language`, `localization`, `log`, `manualimport`,
`mediacover`, `metadata`, `notification`, `parse`, `qualitydefinition`,
`qualityprofile`, `queue`, `release`, `releaseprofile`,
`remotepathmapping`, `rename`, `rootfolder`, `system`, `tag`, `update`,
`wanted`

App-specific resources live in the per-app docs.

## Errors

There's **no documented error schema** — `components.schemas`
contains nothing matching `Error|Problem|ProblemDetails`. In practice
errors come back as one of:

- ASP.NET-default `ProblemDetails` JSON (`{ "type", "title", "status", "detail" }`)
- A plain text body
- Empty body (e.g. some 404s)
- ASP.NET model-validation JSON for 400s (`{ "errors": { "<field>": [...] } }`)

`ServarrClient.request` (`src/base.ts`) treats any non-2xx as failure
and surfaces the raw body (truncated to 200 chars) in the thrown
error. Don't try to parse error bodies as a known shape — log them
and let the caller handle.

## Cross-cutting gotchas

### Swagger UI disabled in production

`/swagger/v3/swagger.json` returns 401 on shipping builds even with
a valid `X-Api-Key`. Enabling it requires `<EnableSwagger>True</EnableSwagger>`
in `config.xml` plus a restart. We don't do that — we read specs
from the GitHub tag instead (see Spec snapshots above).

### `DELETE /queue/{id}` flags are identical across the 4 media apps

Sonarr, Radarr, Lidarr, and Readarr all expose the same four query
flags on queue removal — verified identical across the spec snapshots:

| Flag             | Default | Effect                                                 |
| ---------------- | ------- | ------------------------------------------------------ |
| `removeFromClient` | `true`  | Tells the download client to delete the download too. The default is destructive — the file leaves the client. |
| `blocklist`      | `false` | Adds the release to the blocklist so it won't be re-grabbed. |
| `skipRedownload` | `false` | Prevents the consuming app from re-searching for a replacement. |
| `changeCategory` | `false` | Move the download to the "tv-recycle"/"movies-recycle" category in the client (if configured) instead of deleting. |

Surface all four explicitly in any `<app>_queue_remove` tool — the
defaults *are not* obviously safe (`removeFromClient=true` deletes
the file). Prowlarr has no `/queue` endpoint at all (it's a search
proxy, not a download manager — see [prowlarr.md](prowlarr.md)).

### Container DNS — host can't see its own hostname

A container running servarr-mcp on the same host as Sonarr/Radarr/etc.
can't reach them via the host's hostname (e.g. `my-nas:8989`).
Containers have their own DNS context. Fix: set `<APP>_URL=http://host.docker.internal:<port>`
and use `extra_hosts: ["host.docker.internal:host-gateway"]` in
`docker-compose.yml`. The compose file already includes the mapping.

## Per-app docs

Each app gets its own catalogue: shared-resource coverage, app-specific
resources, currently-built tools, candidate tools, scope-out list,
gotchas.

- [Sonarr](sonarr.md) — TV (`/api/v3`)
- [Radarr](radarr.md) — Movies (`/api/v3`)
- [Lidarr](lidarr.md) — Music (`/api/v1`)
- [Readarr](readarr.md) — Books (`/api/v1`)
- [Prowlarr](prowlarr.md) — Indexer manager (`/api/v1`)
