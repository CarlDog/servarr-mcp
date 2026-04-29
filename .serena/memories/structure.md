# Codebase structure

```
servarr-mcp/
├── src/
│   ├── index.ts        # MCP server entry — iterates apps[], registers configured ones
│   ├── base.ts         # ServarrClient base class + asText() helper
│   ├── sonarr.ts       # SonarrClient (v3) + registerSonarrTools
│   ├── radarr.ts       # RadarrClient (v3) + registerRadarrTools
│   ├── lidarr.ts       # LidarrClient (v1) + registerLidarrTools
│   ├── readarr.ts      # ReadarrClient (v1) + registerReadarrTools
│   └── prowlarr.ts     # ProwlarrClient (v1) + registerProwlarrTools
├── dist/               # tsc output — gitignored
├── .githooks/
│   └── pre-commit      # gitleaks scan
├── Dockerfile          # multi-stage: build → runtime (alpine, non-root)
├── package.json        # type: module, ESM
├── tsconfig.json       # strict + noUncheckedIndexedAccess
├── .gitignore
├── .gitleaks.toml
├── .dockerignore
├── .env.example        # all 5 apps' URL/API_KEY placeholders
├── CLAUDE.md
├── STATUS.md           # single source of truth for project status
└── README.md
```

**Tools registered** (all read-only, ~30 total):

| App | Tools |
| --- | --- |
| Sonarr | list_series, get_series, lookup_series, list_episodes, calendar, queue, history |
| Radarr | list_movies, get_movie, lookup_movie, calendar, queue, history |
| Lidarr | list_artists, get_artist, lookup_artist, list_albums, queue, history |
| Readarr | list_authors, get_author, lookup_author, list_books, queue, history |
| Prowlarr | list_indexers, indexer_stats, search, history |

**Adding a new tool** to an existing app:
1. Add a method to `<App>Client` in `src/<app>.ts`
2. Add a `server.registerTool(...)` call in the same file's `register<App>Tools` function
3. Use `zod` for input schema; wrap the result with `asText()` from `./base.js`

**Adding a new app:**
1. Create `src/<newapp>.ts` with `<NewApp>Client extends ServarrClient` and
   `register<NewApp>Tools` — copy an existing app file as a template
2. Add an entry to the `apps` array in `src/index.ts`
3. Add `<NEWAPP>_URL` / `<NEWAPP>_API_KEY` to `.env.example`
4. Update README.md tools table and config table
