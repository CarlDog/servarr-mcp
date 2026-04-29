# Task completion checklist

Before marking a code-touching task done:

1. **Typecheck:** `npm run typecheck` (must be clean)
2. **Build:** `npm run build` (must succeed; verifies `dist/*.js` outputs)
3. **Lint:** `npm run lint` (eslint, CI-enforced)
4. **Format:** `npm run format:check` (prettier, CI-enforced; run
   `npm run format` to auto-fix)
5. **Tests:** none yet — when added, run them here
6. **Manual verification (when relevant):**
   - For tool changes: run `npm run dev` against a real instance of the
     affected app and call the tool via an MCP client (Claude Desktop or
     `mcp inspector`). Verify the JSON response is sensible.
   - For Dockerfile changes: `docker build -t servarr-mcp .` and confirm
     `docker run -i --rm -e <APP>_URL=... -e <APP>_API_KEY=... servarr-mcp`
     produces a clean stdio handshake with at least the `<APP>_*` tools
     registered.
7. **Endpoint verification (first time touching a new endpoint):**
   Cross-reference against `docs/specs/<app>.json` (the version-pinned
   OpenAPI snapshot) for query parameter names and response shapes.
   If the live instance disagrees with the spec, that's a real
   gotcha — record it in `docs/<app>.md` "gotchas" section and update
   STATUS.md "Known Gaps."
8. **Per-app docs:** if a new tool was added, move its row from the
   "Candidate" table in `docs/<app>.md` to the "Currently exposed
   tools" table in the same commit.
9. **STATUS.md:** update in the same commit as the work if the change
   advances or alters project state. Don't batch status updates.
10. **Commit:** the pre-commit hook runs gitleaks + PII scan
    automatically. If it fails, fix the underlying issue — never
    bypass with `--no-verify`.

## Don't

- Don't run `npm install` to "fix" build issues without understanding
  what changed.
- Don't add tests *for the impossible* — test real behavior, not
  hypotheticals that can't happen given system constraints.
- Don't introduce mocks for the Servarr APIs in tests. Use real instances
  behind env-gated tests (per global working-style on mock/prod divergence).
- Don't lower the test bar to make code pass. Fix the code, not the test.
- Don't commit with the global git identity — verify
  `git config user.email` shows the noreply address before committing.
- Don't add an app to the `apps` array in `src/index.ts` without also
  creating its client file, env-var documentation, and README entry.
