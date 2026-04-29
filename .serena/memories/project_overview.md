# servarr-mcp — project overview

**Purpose:** MCP (Model Context Protocol) server that exposes the
Servarr stack (Sonarr, Radarr, Lidarr, Readarr, Prowlarr) to MCP
clients (Claude Desktop, etc.) for browse and search. Packaged as a
Docker container.

**Status:** See `STATUS.md` in the repo root — single source of truth.
Do not duplicate status here.

**Tech stack**
- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` v1.x — high-level `McpServer` API
- `zod` for tool input schemas
- Servarr REST APIs accessed directly via `fetch` (no third-party clients)
- Multi-stage Docker build (alpine base, non-root user `servarr`)

**Transports (mutually exclusive per process):**
- **stdio** (default — `MCP_PORT` unset). MCP clients invoke
  `docker run -i --rm ...` and pipe stdin/stdout to the container.
- **HTTP (Streamable HTTP)** when `MCP_PORT` is set. Server listens on
  `:$MCP_PORT/mcp` (per-session via `mcp-session-id` header) plus
  `/health` for healthchecks. Used by the `docker-compose.yml` /
  Portainer deployment that runs at `http://your-nas:3002/mcp`.

Per-session `McpServer` instances via `createServer()`; client
instances are computed once at startup from env vars.

**Auth pattern:** every Servarr app uses an `X-Api-Key` header. Each
app is configured via two env vars: `<APP>_URL` and `<APP>_API_KEY`.
Apps with both vars set get their tools registered; apps without get
silently skipped. Server exits 1 only if zero apps are configured.

**API path matrix:**
- v3: Sonarr, Radarr → `/api/v3/...`
- v1: Lidarr, Readarr, Prowlarr → `/api/v1/...`
- Set per-subclass in the constructor — don't hoist into the base.

**Repo:** https://github.com/CarlDog/servarr-mcp (public — upstream)

**Git author convention:** set the local repo author to a no-reply
email (e.g. GitHub's `<numeric-id>+<username>@users.noreply.github.com`
pattern) so personal email never lands in public commit metadata.
Configure per-repo, not globally — verify with `git config user.email`
before the first commit.

**API research:** OpenAPI snapshots for all five apps live in
`docs/specs/<app>.json`, pinned to the deployed versions. Live
`/swagger/v3/swagger.json` is disabled in shipping builds (401), so
specs come from each project's GitHub repo at the matching version
tag. Cross-cutting reference: `docs/SERVARR-API.md`. Per-app
endpoint catalogues + tool decisions: `docs/<app>.md`.

**Sister project:** `plex-mcp` (https://github.com/CarlDog/plex-mcp)
follows the same pattern for Plex Media Server. Conventions are
deliberately identical, including the docs/ research-first workflow
(spec snapshots → cross-cutting doc → per-app catalogues → tools).
