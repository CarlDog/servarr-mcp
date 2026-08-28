# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The v0.1.0 entry is a backfill (standards UNI-12 / UNI-19) reconstructed from
git history and STATUS.md — this repo shipped to the NAS before it carried a
changelog, and `package.json` never moved off its scaffold default across 141
commits. From here forward, update this file alongside the work rather than
after the fact.

## [Unreleased]

### Changed

- **Package renamed to `@carldog/servarr-mcp`.** The unscoped name
  `servarr-mcp` was still free, but three fleet repos had already lost
  theirs to unrelated packages; a scope is reserved to the account, so no
  name inside it can be taken. Nothing is published to npm - this ships as a
  container - so the rename is invisible to consumers; `package-lock.json`
  was regenerated with it.
- **`package.json` is now `private: true`.** It makes the config honest
  (there is no publish workflow and no `NPM_TOKEN`) and makes an accidental
  `npm publish` fail instead of succeeding.

## [0.1.0] - 2026-08-28

First tagged release. Deployed on the NAS, wrapping the Servarr stack:
Sonarr (TV), Radarr (movies), Lidarr (music), Readarr (books) and Prowlarr
(indexers). Each app is optional — its tools register only when both URL and
API key are configured, so the visible tool set reflects what actually runs.

### Added

- **Read tools** across every app: library listing and lookup (`*_list_*` for
  what's tracked, `*_lookup_*` for upstream metadata search), calendar for
  Sonarr and Radarr, queue, history, health, diskspace, quality profiles,
  metadata profiles, root folders and tags.
- **Write tools** — add media (`sonarr_add_series`, `radarr_add_movie`,
  `lidarr_add_artist`, `readarr_add_author`) and their edit counterparts.
- **Queue management** — `<app>_queue_remove` and `<app>_queue_regrab` to
  force a re-grab of stuck items.
- **Interactive release search and grab**, plus `<app>_history_mark_failed`.
- **Command triggers** — `search_<resource>`, `refresh_<resource>`, and
  `search_missing` across the four media apps.
- Prowlarr read tools: indexer listing, stats, status, history, and a direct
  `prowlarr_search` across indexers.
- MCP annotations (`readOnlyHint` / `destructiveHint` / `idempotentHint`) on
  every tool, so callers can distinguish reads from writes mechanically.
- Vendored OpenAPI specs under `docs/specs/` pinned to the deployed builds,
  with the refresh process documented in `docs/SERVARR-API.md` — this repo is
  the fleet's `spec-pinned` API-surface tier template.
- The reported server version is derived from `package.json`
  (`src/shared/version.ts` + `src/shared/version-sync.test.ts`, MCP-T03).

### Changed

- Moved onto the shared Docker `bridge` network, relieving the NAS's
  exhausted default address pool.
- `flavor: latest=false` on the publish workflow, so a release tag publishes
  `X.Y.Z` and `X.Y` without republishing `:latest` (UNI-19).
- Readarr is disabled on the NAS deploy until its upstream metadata source is
  fixed; its tools remain implemented and tested.

### Fixed

- Transport failures surface their real cause instead of Node's bare
  `TypeError: fetch failed` (MCP-F08). `requestOnce()`'s catch had built its
  message from `err.message` only, discarding the actual DNS/connection/TLS
  reason in `error.cause`.
- Source files are locked to LF in `.gitattributes`, after a CRLF checkout
  broke on Linux CI.
- `host.docker.internal` mapping added for same-host deploys, so the
  container can reach apps running on the Docker host.
