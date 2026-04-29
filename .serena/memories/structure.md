# Codebase structure

```
servarr-mcp/
├── src/
│   ├── index.ts                # MCP server entry / composition root
│   ├── clients/
│   │   ├── base.ts             # ServarrClient base class + asText() helper
│   │   ├── sonarr.ts           # SonarrClient (v3) — class only
│   │   ├── radarr.ts           # RadarrClient (v3)
│   │   ├── lidarr.ts           # LidarrClient (v1)
│   │   ├── readarr.ts          # ReadarrClient (v1)
│   │   └── prowlarr.ts         # ProwlarrClient (v1)
│   └── tools/
│       ├── sonarr/index.ts     # registerSonarrTools — current 7 registrations
│       ├── radarr/index.ts     # registerRadarrTools
│       ├── lidarr/index.ts     # registerLidarrTools
│       ├── readarr/index.ts    # registerReadarrTools
│       └── prowlarr/index.ts   # registerProwlarrTools
├── docs/
│   ├── SERVARR-API.md          # cross-cutting API reference
│   ├── sonarr.md               # per-app endpoint catalogue + tool decisions
│   ├── radarr.md
│   ├── lidarr.md
│   ├── readarr.md
│   ├── prowlarr.md
│   └── specs/                  # version-pinned OpenAPI snapshots (LF-locked)
│       └── <app>.json
├── dist/                       # tsc output — gitignored
├── .githooks/pre-commit        # gitleaks + PII scan
├── Dockerfile                  # multi-stage: build → runtime (alpine, non-root)
├── docker-compose.yml          # Compose/Portainer deployment (HTTP transport)
├── package.json                # type: module, ESM
├── tsconfig.json               # strict + noUncheckedIndexedAccess
├── eslint.config.js
├── .prettierrc / .prettierignore
├── .gitignore / .gitattributes / .gitleaks.toml
├── .env.example
├── CLAUDE.md
├── STATUS.md                   # single source of truth for project status
└── README.md
```

## Layered architecture

- **Driving adapter:** `src/tools/<app>/` — MCP tool registrations.
  Each `register<App>Tools(server, client)` is the boundary the MCP
  SDK calls into.
- **Driven adapter:** `src/clients/<app>.ts` — HTTP client per app,
  subclass of `ServarrClient` (in `clients/base.ts`).
- **Composition root:** `src/index.ts` — reads env, instantiates
  enabled clients, calls each `register<App>Tools` for those clients.

The `tools/` directory imports from `clients/` (one direction). No
client imports a tool. Today there's no domain layer between them —
each tool is a thin wrapper over a single client method, and there's
no business logic to abstract.

## Adding a new tool to an existing app

1. Add a method to `<App>Client` in `src/clients/<app>.ts` (only if a
   new HTTP call is needed — many tools just call existing methods).
2. Add a `server.registerTool(...)` call in `src/tools/<app>/index.ts`.
3. Use `zod` for input schema; wrap the result with `asText()`
   imported from `../../clients/base.js`.
4. Update `docs/<app>.md` — move the tool from "Candidate" to
   "Currently exposed."
5. If `tools/<app>/index.ts` crosses ~150 lines or a resource group
   reaches 3+ tools, split it: create
   `src/tools/<app>/<resource>.ts` exporting
   `register<Resource>Tools`, and call it from `index.ts`.

## Adding a new app

1. Create `src/clients/<newapp>.ts` with `<NewApp>Client extends
   ServarrClient` — copy an existing client file as a template.
2. Create `src/tools/<newapp>/index.ts` with `register<NewApp>Tools`.
3. Add an entry to the `apps` array in `src/index.ts`.
4. Add `<NEWAPP>_URL` / `<NEWAPP>_API_KEY` to `.env.example`.
5. Snapshot the OpenAPI spec into `docs/specs/<newapp>.json`,
   version-pinned to the deployed instance.
6. Write `docs/<newapp>.md` following the template established by
   `docs/sonarr.md` (resource catalogue, currently-exposed tools,
   candidates, out-of-scope, gotchas).
7. Update `README.md` tools table and config table.
8. Update `docs/SERVARR-API.md` per-app docs index.

## Currently exposed tools (read-only)

| App | Tools |
| --- | --- |
| Sonarr | list_series, get_series, lookup_series, list_episodes, calendar, queue, history |
| Radarr | list_movies, get_movie, lookup_movie, calendar, queue, history |
| Lidarr | list_artists, get_artist, lookup_artist, list_albums, queue, history |
| Readarr | list_authors, get_author, lookup_author, list_books, queue, history |
| Prowlarr | list_indexers, indexer_stats, search, history |

Per-app docs (`docs/<app>.md`) catalogue ~1070 endpoints across the
five apps — most are **not** exposed yet. The candidate-tools tables
in those docs are the backlog.
