# Suggested commands

Originally developed on Windows with bash (Git Bash) and PowerShell;
the commands below assume one of those shells. Forward slashes in
paths work in bash; backslashes in PowerShell.

## Node / build

```bash
npm install            # install deps
npm run typecheck      # tsc --noEmit (fast feedback)
npm run build          # tsc → dist/
npm run dev            # tsx src/index.ts (needs at least one app's env vars)
npm run start          # node dist/index.js
npm run lint           # eslint . (CI runs this)
npm run format:check   # prettier --check . (CI runs this)
npm run format         # prettier --write .  (apply fixes)
```

**`docs/specs/*.json` is excluded from prettier** via `.prettierignore`
— those snapshots come from upstream verbatim and reformatting them
would corrupt the refresh-diff invariant.

## Docker

```bash
docker build -t servarr-mcp .
docker run -i --rm \
  -e SONARR_URL=http://192.168.1.x:8989 -e SONARR_API_KEY=... \
  -e RADARR_URL=http://192.168.1.x:7878 -e RADARR_API_KEY=... \
  -e PROWLARR_URL=http://192.168.1.x:9696 -e PROWLARR_API_KEY=... \
  servarr-mcp
```

Default ports: Sonarr 8989, Radarr 7878, Lidarr 8686, Readarr 8787, Prowlarr 9696.

## Git / GitHub

```bash
git status
git add <specific-files>      # don't use `git add .` per security rules
git commit -m "..."            # pre-commit hook runs gitleaks
git push
gh repo view --web             # open repo in browser
gh pr create                    # open PR (when on a branch)
```

The pre-commit hook is enabled via `git config core.hooksPath .githooks`
(already done in this repo). Requires `gitleaks` on PATH — install via
`winget install gitleaks` on Windows, `brew install gitleaks` on macOS,
or your distro's package manager on Linux.

## Secret scan (manual)

```bash
gitleaks detect --no-git --redact --config .gitleaks.toml --source .
```

## Windows-specific notes (when applicable)

- On Windows, `bash` is Git Bash (Unix-like). Drive letters map as
  `/c/path` ↔ `C:\path`.
- Avoid `find`, `grep`, `cat`, `ls -R` for file ops — use the Glob/Grep/Read tools.
- Line endings: with autocrlf, working tree is CRLF on Windows and the
  repo stays LF. Shell scripts checked into the repo (e.g.
  `.githooks/pre-commit`) must keep LF endings to run on Linux/Docker.
