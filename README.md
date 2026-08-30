# servarr-mcp

<!-- fleet-confidence -->
![code confidence](https://img.shields.io/badge/code_confidence-fair-orange) <sub>· `claude-opus-4-8[1m]` · 2026-07-07 · [details](https://github.com/CarlDog/servarr-mcp/issues/2)</sub>
<!-- /fleet-confidence -->


An [MCP](https://modelcontextprotocol.io) server for the
[Servarr](https://wiki.servarr.com/) stack — Sonarr, Radarr, Lidarr,
Readarr, and Prowlarr — packaged as a Docker container. Lets an MCP
client (Claude Desktop, etc.) browse, search, and manage whichever
*arr apps you're running: library reads plus add/edit, queue
management, interactive release grabbing, and search/refresh
commands. Every tool carries MCP annotations (`readOnlyHint`,
`destructiveHint`, `idempotentHint`) so clients can distinguish and
gate the write surface.

Apps are optional: configure only the ones you actually run, and only
those tools register.

## Tools

### Sonarr (TV)

Read:

| Tool | Description |
| --- | --- |
| `sonarr_list_series` | List all TV series tracked by Sonarr |
| `sonarr_get_series` | Series details by ID |
| `sonarr_lookup_series` | Search TVDB for a new series to add |
| `sonarr_list_episodes` | List episodes for a series |
| `sonarr_get_episode` | Episode details by ID |
| `sonarr_calendar` | Upcoming episodes |
| `sonarr_queue` | Current download queue |
| `sonarr_manual_import_candidates` | Discover bounded manual-import candidates with episode/file context |
| `sonarr_history` | Recent history (newest first) |
| `sonarr_history_series` | History for one series |
| `sonarr_wanted_missing` | Monitored episodes with no file |
| `sonarr_wanted_cutoff` | Episodes below their quality cutoff |
| `sonarr_release_search` | Live indexer search for candidate releases |
| `sonarr_get_command` | Poll an async command's status |
| `sonarr_health` | Health check results |
| `sonarr_diskspace` | Disk space per root folder |
| `sonarr_list_quality_profiles` | Quality profiles |
| `sonarr_list_root_folders` | Root folders |
| `sonarr_list_tags` | Tags |

Write:

| Tool | Description |
| --- | --- |
| `sonarr_add_series` | Add a series to the library |
| `sonarr_edit_series` | Edit a tracked series (monitoring, profile, etc.) |
| `sonarr_grab_release` | Grab a release from `sonarr_release_search` results |
| `sonarr_manual_import` | Confirm-gated import of one exact candidate into explicit episode ids |
| `sonarr_queue_remove` | Remove a queue item (optionally blocklist / delete from client) |
| `sonarr_queue_regrab` | Force re-grab of a stuck queue item |
| `sonarr_history_mark_failed` | Mark a history record failed (triggers re-search) |
| `sonarr_search_missing` | Trigger a search for missing episodes |
| `sonarr_search_series` | Trigger a search for a whole series |
| `sonarr_search_season` | Trigger a search for one season |
| `sonarr_search_episode` | Trigger a search for specific episodes |
| `sonarr_refresh_series` | Refresh series metadata and rescan disk |

### Radarr (movies)

Read:

| Tool | Description |
| --- | --- |
| `radarr_list_movies` | All movies tracked by Radarr |
| `radarr_get_movie` | Movie details by ID |
| `radarr_lookup_movie` | Search TMDB for a new movie to add |
| `radarr_lookup_tmdb` | Look up a movie by TMDB ID |
| `radarr_lookup_imdb` | Look up a movie by IMDb ID |
| `radarr_calendar` | Upcoming movie releases |
| `radarr_queue` | Current download queue |
| `radarr_manual_import_candidates` | Discover bounded manual-import candidates with movie/file context |
| `radarr_history` | Recent history (newest first) |
| `radarr_history_movie` | History for one movie |
| `radarr_wanted_missing` | Monitored movies with no file |
| `radarr_wanted_cutoff` | Movies below their quality cutoff |
| `radarr_release_search` | Live indexer search for candidate releases |
| `radarr_get_command` | Poll an async command's status |
| `radarr_health` | Health check results |
| `radarr_diskspace` | Disk space per root folder |
| `radarr_list_quality_profiles` | Quality profiles |
| `radarr_list_root_folders` | Root folders |
| `radarr_list_tags` | Tags |

Write:

| Tool | Description |
| --- | --- |
| `radarr_add_movie` | Add a movie to the library |
| `radarr_edit_movie` | Edit a tracked movie (monitoring, profile, etc.) |
| `radarr_grab_release` | Grab a release from `radarr_release_search` results |
| `radarr_manual_import` | Confirm-gated import of one exact candidate into an explicit movie id |
| `radarr_queue_remove` | Remove a queue item (optionally blocklist / delete from client) |
| `radarr_queue_regrab` | Force re-grab of a stuck queue item |
| `radarr_history_mark_failed` | Mark a history record failed (triggers re-search) |
| `radarr_search_missing` | Trigger a search for missing movies |
| `radarr_search_movie` | Trigger a search for specific movies |
| `radarr_refresh_movie` | Refresh movie metadata and rescan disk |

### Lidarr (music)

Read:

| Tool | Description |
| --- | --- |
| `lidarr_list_artists` | All artists tracked by Lidarr |
| `lidarr_get_artist` | Artist details by ID |
| `lidarr_lookup_artist` | Search for a new artist to add |
| `lidarr_list_albums` | List albums (optionally per-artist) |
| `lidarr_get_album` | Album details by ID |
| `lidarr_get_track` | Track details |
| `lidarr_list_trackfiles` | Track files on disk |
| `lidarr_queue` | Current download queue |
| `lidarr_manual_import_candidates` | Discover bounded manual-import candidates with album/track context |
| `lidarr_history` | Recent history |
| `lidarr_history_artist` | History for one artist |
| `lidarr_wanted_missing` | Monitored albums with no files |
| `lidarr_wanted_cutoff` | Albums below their quality cutoff |
| `lidarr_release_search` | Live indexer search for candidate releases |
| `lidarr_get_command` | Poll an async command's status |
| `lidarr_health` | Health check results |
| `lidarr_diskspace` | Disk space per root folder |
| `lidarr_list_quality_profiles` | Quality profiles |
| `lidarr_list_metadata_profiles` | Metadata profiles |
| `lidarr_list_root_folders` | Root folders |
| `lidarr_list_tags` | Tags |

Write:

| Tool | Description |
| --- | --- |
| `lidarr_add_artist` | Add an artist to the library |
| `lidarr_edit_artist` | Edit a tracked artist (monitoring, profiles, etc.) |
| `lidarr_grab_release` | Grab a release from `lidarr_release_search` results |
| `lidarr_manual_import` | Confirm-gated import with explicit artist/album/release/track ids and replacement choice |
| `lidarr_queue_remove` | Remove a queue item (optionally blocklist / delete from client) |
| `lidarr_queue_regrab` | Force re-grab of a stuck queue item |
| `lidarr_history_mark_failed` | Mark a history record failed (triggers re-search) |
| `lidarr_search_missing` | Trigger a search for missing albums |
| `lidarr_search_artist` | Trigger a search for an artist's albums |
| `lidarr_search_album` | Trigger a search for specific albums |
| `lidarr_refresh_artist` | Refresh artist metadata and rescan disk |

### Readarr (books)

Read:

| Tool | Description |
| --- | --- |
| `readarr_list_authors` | All authors tracked by Readarr |
| `readarr_get_author` | Author details by ID |
| `readarr_lookup_author` | Search for a new author to add |
| `readarr_list_books` | List books (optionally per-author) |
| `readarr_get_book` | Book details by ID |
| `readarr_queue` | Current download queue |
| `readarr_manual_import_candidates` | Discover bounded manual-import candidates with book/edition context |
| `readarr_history` | Recent history |
| `readarr_history_author` | History for one author |
| `readarr_wanted_missing` | Monitored books with no files |
| `readarr_wanted_cutoff` | Books below their quality cutoff |
| `readarr_release_search` | Live indexer search for candidate releases |
| `readarr_get_command` | Poll an async command's status |
| `readarr_health` | Health check results |
| `readarr_diskspace` | Disk space per root folder |
| `readarr_list_quality_profiles` | Quality profiles |
| `readarr_list_metadata_profiles` | Metadata profiles |
| `readarr_list_root_folders` | Root folders |
| `readarr_list_tags` | Tags |

Write:

| Tool | Description |
| --- | --- |
| `readarr_add_author` | Add an author to the library |
| `readarr_edit_author` | Edit a tracked author (monitoring, profiles, etc.) |
| `readarr_grab_release` | Grab a release from `readarr_release_search` results |
| `readarr_manual_import` | Confirm-gated import with explicit author/book/edition ids and replacement choice |
| `readarr_queue_remove` | Remove a queue item (optionally blocklist / delete from client) |
| `readarr_queue_regrab` | Force re-grab of a stuck queue item |
| `readarr_history_mark_failed` | Mark a history record failed (triggers re-search) |
| `readarr_search_missing` | Trigger a search for missing books |
| `readarr_search_author` | Trigger a search for an author's books |
| `readarr_search_book` | Trigger a search for specific books |
| `readarr_refresh_author` | Refresh author metadata and rescan disk |

### Prowlarr (indexer manager)

Read-only:

| Tool | Description |
| --- | --- |
| `prowlarr_list_indexers` | All configured indexers |
| `prowlarr_indexer_stats` | Per-indexer query/grab stats |
| `prowlarr_indexer_status` | Indexer health / disabled status |
| `prowlarr_search` | Search across enabled indexers |
| `prowlarr_history` | Recent history (queries, grabs) |
| `prowlarr_health` | Health check results |

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
