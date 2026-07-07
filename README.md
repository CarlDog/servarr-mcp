# servarr-mcp

<!-- fleet-confidence -->
![code confidence](https://img.shields.io/badge/code_confidence-fair-orange) <sub>· `claude-opus-4-8[1m]` · 2026-07-07 · [details](https://github.com/CarlDog/servarr-mcp/issues/2)</sub>
<!-- /fleet-confidence -->


An [MCP](https://modelcontextprotocol.io) server for the
[Servarr](https://wiki.servarr.com/) stack — Sonarr, Radarr, Lidarr,
Readarr, and Prowlarr — packaged as a Docker container. Lets an MCP
client (Claude Desktop, etc.) browse and search whichever *arr apps
you're running.

Apps are optional: configure only the ones you actually run, and only
those tools register.

## Tools

### Sonarr (TV)

| Tool | Description |
| --- | --- |
| `sonarr_list_series` | List all TV series tracked by Sonarr |
| `sonarr_get_series` | Series details by ID |
| `sonarr_lookup_series` | Search TVDB for a new series to add |
| `sonarr_list_episodes` | List episodes for a series |
| `sonarr_calendar` | Upcoming episodes |
| `sonarr_queue` | Current download queue |
| `sonarr_history` | Recent history (newest first) |

### Radarr (movies)

| Tool | Description |
| --- | --- |
| `radarr_list_movies` | All movies tracked by Radarr |
| `radarr_get_movie` | Movie details by ID |
| `radarr_lookup_movie` | Search TMDB for a new movie to add |
| `radarr_calendar` | Upcoming movie releases |
| `radarr_queue` | Current download queue |
| `radarr_history` | Recent history (newest first) |

### Lidarr (music)

| Tool | Description |
| --- | --- |
| `lidarr_list_artists` | All artists tracked by Lidarr |
| `lidarr_get_artist` | Artist details by ID |
| `lidarr_lookup_artist` | Search for a new artist to add |
| `lidarr_list_albums` | List albums (optionally per-artist) |
| `lidarr_queue` | Current download queue |
| `lidarr_history` | Recent history |

### Readarr (books)

| Tool | Description |
| --- | --- |
| `readarr_list_authors` | All authors tracked by Readarr |
| `readarr_get_author` | Author details by ID |
| `readarr_lookup_author` | Search for a new author to add |
| `readarr_list_books` | List books (optionally per-author) |
| `readarr_queue` | Current download queue |
| `readarr_history` | Recent history |

### Prowlarr (indexer manager)

| Tool | Description |
| --- | --- |
| `prowlarr_list_indexers` | All configured indexers |
| `prowlarr_indexer_stats` | Per-indexer query/grab stats |
| `prowlarr_search` | Search across enabled indexers |
| `prowlarr_history` | Recent history (queries, grabs) |

## Configuration

Each app uses two environment variables. Set both for an app to
enable its tools; leave them unset to skip the app entirely.

| App | URL var | API key var | Default port |
| --- | --- | --- | --- |
| Sonarr | `SONARR_URL` | `SONARR_API_KEY` | 8989 |
| Radarr | `RADARR_URL` | `RADARR_API_KEY` | 7878 |
| Lidarr | `LIDARR_URL` | `LIDARR_API_KEY` | 8686 |
| Readarr | `READARR_URL` | `READARR_API_KEY` | 8787 |
| Prowlarr | `PROWLARR_URL` | `PROWLARR_API_KEY` | 9696 |

API keys are found under each app's *Settings → General → API Key*.

At least one app must be configured or the server exits with an error.

### Same-host deployments

When the *arr apps run on the same Docker host as this container
(typical home-lab setup), don't use the host's hostname (e.g.
`my-nas`) in the `*_URL` vars — Docker's DNS context can't resolve
the host's own name from inside a container. Use
`http://host.docker.internal:<port>` instead. The provided
`docker-compose.yml` already maps `host.docker.internal` to the host
gateway via `extra_hosts`, so this works on Linux Docker too (not
just Docker Desktop).

## Run with Docker

```bash
docker build -t servarr-mcp .
docker run -i --rm \
  -e SONARR_URL=http://192.168.1.50:8989 -e SONARR_API_KEY=... \
  -e RADARR_URL=http://192.168.1.50:7878 -e RADARR_API_KEY=... \
  -e PROWLARR_URL=http://192.168.1.50:9696 -e PROWLARR_API_KEY=... \
  servarr-mcp
```

## Published image

After each push to `main`, GitHub Actions builds and pushes a multi-arch
image to GHCR:

`ghcr.io/carldog/servarr-mcp:latest` (linux/amd64 + linux/arm64)

Pull instead of building locally:

```bash
docker pull ghcr.io/carldog/servarr-mcp:latest
docker run -i --rm \
  -e SONARR_URL=... -e SONARR_API_KEY=... \
  ghcr.io/carldog/servarr-mcp:latest
```

## Run with Docker Compose (HTTP, long-lived)

The compose file runs the server in HTTP mode (Streamable HTTP) for
long-lived deployment via Portainer or Compose. It pulls the published
image from `ghcr.io/carldog/servarr-mcp:latest`.

```bash
# Set whichever app credentials apply:
export SONARR_URL=http://192.168.1.50:8989; export SONARR_API_KEY=...
export RADARR_URL=http://192.168.1.50:7878; export RADARR_API_KEY=...
# ... (other apps as needed)
export HOST_PORT=3002  # optional, defaults to 3002

docker compose up
```

The MCP endpoint will be at `http://<host>:${HOST_PORT}/mcp`.

## Deploy via Portainer (Stack from Git)

1. In Portainer, *Stacks → Add Stack → Repository*.
2. Repository URL: `https://github.com/CarlDog/servarr-mcp`
3. Compose path: `docker-compose.yml`
4. Environment variables: set whichever `<APP>_URL`/`<APP>_API_KEY`
   pairs apply, plus optionally `HOST_PORT`.
5. Deploy. Healthcheck reaches green within ~10 seconds.

## Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "servarr": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "SONARR_URL", "-e", "SONARR_API_KEY",
        "-e", "RADARR_URL", "-e", "RADARR_API_KEY",
        "-e", "PROWLARR_URL", "-e", "PROWLARR_API_KEY",
        "servarr-mcp"
      ],
      "env": {
        "SONARR_URL": "http://192.168.1.50:8989",
        "SONARR_API_KEY": "...",
        "RADARR_URL": "http://192.168.1.50:7878",
        "RADARR_API_KEY": "...",
        "PROWLARR_URL": "http://192.168.1.50:9696",
        "PROWLARR_API_KEY": "..."
      }
    }
  }
}
```

Repeat the `-e` and `env` block patterns for whichever apps you run.

## Local development

```bash
npm install
cp .env.example .env  # then edit
SONARR_URL=... SONARR_API_KEY=... npm run dev
```

## Security

- The container runs as a non-root user (`servarr`).
- API keys are passed via env vars — never bake them into the image.
- A `.githooks/pre-commit` runs gitleaks on every commit. Activate it
  once per clone: `git config core.hooksPath .githooks`.
