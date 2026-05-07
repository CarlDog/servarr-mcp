# Codebase structure

```
servarr-mcp/
├── src/
│   ├── index.ts                # MCP server entry / composition root
│   ├── clients/
│   │   ├── base.ts             # ServarrClient base + asText() + withProgress() + ANN_* annotation bundles
│   │   ├── base.test.ts        # unit tests for the helpers
│   │   ├── sonarr.ts           # SonarrClient (v3) — class only
│   │   ├── sonarr.integration.test.ts    # read-only integration suite (env-gated)
│   │   ├── radarr.ts           # RadarrClient (v3)
│   │   ├── radarr.integration.test.ts
│   │   ├── lidarr.ts           # LidarrClient (v1)
│   │   ├── lidarr.integration.test.ts
│   │   ├── readarr.ts          # ReadarrClient (v1)
│   │   ├── prowlarr.ts         # ProwlarrClient (v1)
│   │   └── prowlarr.integration.test.ts
│   └── tools/
│       ├── _test_utils.ts      # CaptureServer + fakeExtra() for testing tool handlers
│       ├── annotations.test.ts # coverage walk: every tool has correct MCP annotations
│       ├── grab_release.test.ts  # mapped*Id → *Id fix-up logic (Radarr + Sonarr)
│       ├── release_search.test.ts  # "at least one id" handler-level guards
│       ├── sonarr/
│       │   ├── index.ts        # registerSonarrTools — calls register*Tools for siblings
│       │   ├── series.ts       # add_series, edit_series
│       │   ├── queue.ts        # queue (paged), queue_remove, queue_regrab
│       │   ├── history.ts      # history, history_series, history_mark_failed
│       │   ├── wanted.ts       # wanted_missing, wanted_cutoff
│       │   ├── commands.ts     # search_*, refresh_*, get_command (poll companion)
│       │   └── releases.ts     # release_search, grab_release
│       ├── radarr/             # same shape (movies.ts instead of series.ts)
│       ├── lidarr/             # same (artists.ts)
│       ├── readarr/            # same (authors.ts)
│       └── prowlarr/index.ts   # registerProwlarrTools — single file (only 6 tools)
├── docs/
│   ├── SERVARR-API.md          # cross-cutting API reference
│   ├── sonarr.md / radarr.md / lidarr.md / readarr.md / prowlarr.md
│   └── specs/<app>.json        # version-pinned OpenAPI snapshots (LF-locked)
├── dist/                       # tsc output — gitignored
├── vitest.config.ts            # loads .env so integration tests pick up creds
├── .githooks/pre-commit        # gitleaks + PII scan
├── Dockerfile / docker-compose.yml
├── package.json (type: module, ESM)
├── tsconfig.json (strict + noUncheckedIndexedAccess)
├── eslint.config.js / .prettierrc / .prettierignore
├── .gitignore / .gitattributes / .gitleaks.toml
├── .env.example
├── CLAUDE.md / STATUS.md / README.md
```

## Layered architecture

- **Driving adapter:** `src/tools/<app>/` — MCP tool registrations.
  Each `register<App>Tools(server, client)` is the boundary the MCP
  SDK calls into. Most apps have multiple resource-sibling files
  (queue.ts, history.ts, wanted.ts, commands.ts, releases.ts, plus
  the entity sibling — series/movies/artists/authors).
- **Driven adapter:** `src/clients/<app>.ts` — HTTP client per app,
  subclass of `ServarrClient` (in `clients/base.ts`).
- **Composition root:** `src/index.ts` — reads env, instantiates
  enabled clients, calls each `register<App>Tools` for those clients.

The `tools/` directory imports from `clients/` (one direction). No
client imports a tool. No domain layer between them — each tool is a
thin wrapper over a single client method.

## Annotation bundles (in `src/clients/base.ts`)

Every `registerTool` call passes one of these so MCP clients can
filter, safety-prompt, and reason about retry behavior:

- `ANN_READ` — *arr-internal reads (most list/get/health/etc.)
- `ANN_READ_EXT` — external metadata fetch or live indexer hit
  (lookup_*, release_search, prowlarr_search)
- `ANN_ADD` — add_<resource> (additive, non-idempotent)
- `ANN_EDIT` — edit_<resource> (idempotent, destructive flag for
  root-folder moves)
- `ANN_COMMAND` — search_*/refresh_* triggers (idempotent at queue
  level, openWorld)
- `ANN_GRAB` — grab_release (additive, non-idempotent, openWorld)
- `ANN_QUEUE_REMOVE` — destructive (can delete file)
- `ANN_QUEUE_REGRAB` — non-idempotent (re-grab spawns fresh)
- `ANN_MARK_FAILED` — destructive (downstream re-grab/replace)

## Adding a new tool to an existing app

1. Add a method to `<App>Client` in `src/clients/<app>.ts` (only if a
   new HTTP call is needed).
2. Decide which sibling file the tool belongs in (or `index.ts` if
   it's a one-off prerequisite-style listing).
3. Add a `server.registerTool(...)` call. Use `zod` for input schema,
   `asText()` for output, and the appropriate `ANN_*` annotation.
   Cross-reference related tools in the description.
4. Update `docs/<app>.md` — move row from "Candidate" to
   "Currently exposed."
5. The annotation-coverage test will fail if you forget the
   `annotations` field — that's the safety net.

## Per-resource splitting

Pull a resource group into its own sibling file (`<resource>.ts`)
when **either**: index.ts crosses ~150 lines, or 3+ tools are
clearly a unit. Already split: queue, history, wanted, commands,
releases, plus the entity siblings.

## Cross-app tools

When the first orchestration tool arrives (e.g. "search Prowlarr
and add to Sonarr or Radarr depending on media type"), create
`src/tools/cross/`. Don't pre-create.

## Tool counts (current)

| App | Tools (in code) |
| --- | --- |
| Sonarr | 29 |
| Radarr | 27 |
| Lidarr | 30 |
| Prowlarr | 6 |
| Readarr | 28 |
| **Total** | **120** |

92 of the 120 register on the deploy (Readarr disabled until its
Goodreads upstream is fixed). Per-app candidate tables in
`docs/<app>.md` are the backlog. STATUS.md captures the current
"Next" priorities.
