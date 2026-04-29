# Conventions

## MCP-specific (CRITICAL)

- **stdout is the MCP wire protocol.** Never `console.log` —
  it corrupts the transport. All logging goes to **stderr** via
  `console.error`. This applies to dependencies too.
- Tool names: `<app>_<verb_noun>` (e.g. `sonarr_list_series`,
  `prowlarr_indexer_stats`). Always snake_case, always app-prefixed.
- Tool inputs: validated with `zod` schemas. Use `.describe(...)` on
  every field — descriptions surface to the LLM caller.
- Tool outputs: a single text content block with JSON-stringified
  payload. Use the `asText()` helper from `./base.js`.
- Errors: thrown from app clients propagate; the MCP SDK wraps them.
  Don't swallow errors silently. Error messages include the app name
  for disambiguation (e.g. "Sonarr 401 Unauthorized for /series").

## App registration

- Apps are **optional**. Missing `<APP>_URL` or `<APP>_API_KEY` →
  the app is silently skipped. No warnings, no errors. The server
  scopes itself to whatever's actually configured.
- The `apps` array in `src/index.ts` is the single source of truth
  for which apps are supported. Adding an app means adding an entry there.
- If zero apps are configured the server exits 1 with a clear message.

## TypeScript

- ESM only (`"type": "module"`). Imports use `.js` extension even when
  importing `.ts` files (NodeNext convention).
- `strict: true` + `noUncheckedIndexedAccess: true`.
- Each app client extends `ServarrClient`. Constructor takes `(url, apiKey)`
  and calls `super({ url, apiKey, apiPath, appName })` with hardcoded
  `apiPath` and `appName`.
- No `any`. Use `unknown` and let the LLM consume the JSON. Don't
  invest in deep response typing — the Servarr API surface is large
  and most fields are returned to the model verbatim.
- Prefer `readonly` on class fields that don't mutate after construction.

## Docker

- Multi-stage. Build stage installs full deps + tsc; runtime stage gets
  only `dist/`, pruned `node_modules`, and `package.json`.
- Runtime image runs as non-root user `servarr`. Don't add `USER root`.
- API keys passed at `docker run` time via `-e <APP>_API_KEY`. Never
  bake into the image, never `ENV ..._API_KEY=...` in the Dockerfile.

## Security

- Per global rules: never print API keys. Error messages from `request()`
  redact response bodies via `.slice(0, 200)` but the URL might still
  echo back if a downstream app includes it in its 4xx response. Audit
  if you change error handling.
- `.gitignore` excludes `*.pem`, `*.key`, `*.pfx`, `*.p12`, `.env`.
- Pre-commit hook runs gitleaks. Don't bypass with `--no-verify`.

## Git

- Local repo author is overridden to noreply (see `project_overview`).
  Don't `git config --unset` it — re-exposes PII.
- `git add <specific-files>`, not `git add .` or `git add -A`.
- Commit messages: imperative mood, short first line, body explaining
  *why* over *what*. End with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
