# Security Policy

## Supported Versions

Only the latest release receives security fixes — tracked by the `latest` tag
on [`ghcr.io/carldog/servarr-mcp`](https://github.com/CarlDog/servarr-mcp/pkgs/container/servarr-mcp).
There is no LTS branch.

## Reporting a Vulnerability

Please report security issues privately using GitHub's
[Security Advisories](https://github.com/CarlDog/servarr-mcp/security/advisories/new)
for this repository, rather than opening a public issue.

Expect an initial response within a few days. This is a solo-maintained
project — there's no formal SLA and no bounty, but reports are taken
seriously and fixes for confirmed issues are prioritized over other work.

## What has real impact here

This server holds up to ten credentials — a URL and an API key for each of
Sonarr, Radarr, Lidarr, Readarr and Prowlarr — and it is **not read-only**.
Alongside the browse and search tools it can add and edit tracked entities,
remove items from queues, mark history failed, and grab releases, which
queues real downloads. Anything in these classes is worth reporting:

- **Credential exposure.** An API key reaching tool output, an error message,
  or a log line. Responses pass through `src/shared/redact.ts`; a gap in that
  redactor, or an outbound call that bypasses it, is a real finding.
- **Auth bypass on the HTTP transport.** `MCP_AUTH_TOKEN` gates `/mcp` and
  `MCP_ALLOWED_HOSTS` is the Host/Origin allowlist that blocks DNS rebinding
  from a browser on the host network. Binding loopback is *not* a substitute
  in a container — the container's loopback is its own, so the server binds
  `0.0.0.0` to be reachable at all. A way past either control matters.
- **Invoking a write tool without its intended gate**, or a read-annotated
  tool that turns out to write. Every tool carries MCP annotations
  (`readOnlyHint` / `destructiveHint` / `idempotentHint`); a tool whose
  annotation understates what it does is a security issue, not just a docs
  bug, because clients filter on those to decide what needs confirmation.
- **Server-side request forgery** via a URL that reaches an unintended host.

## Deployment notes that are not vulnerabilities

Running with `MCP_AUTH_TOKEN` unset on a trusted network is an operator
choice; the server warns loudly on startup. The same applies to
`MCP_ALLOWED_HOSTS`. Reachability of a misconfigured *arr instance, and any
consequence of pointing this server at one you don't control, are also
deployment concerns rather than defects here.
