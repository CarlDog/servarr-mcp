import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, ANN_READ_EXT, asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  pickFields,
} from "../_paging.js";
import { registerCommandTools } from "./commands.js";
import { registerHistoryTools } from "./history.js";
import { registerMovieTools } from "./movies.js";
import { registerQueueTools } from "./queue.js";
import { registerReleaseTools } from "./releases.js";
import { registerWantedTools } from "./wanted.js";

const SLIM_MOVIE_FIELDS = [
  "id",
  "title",
  "year",
  "monitored",
  "hasFile",
  "sizeOnDisk",
  "qualityProfileId",
  "tags",
  "path",
  "imdbId",
  "tmdbId",
  "status",
] as const;

export function registerRadarrTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_list_movies",
    {
      title: "Radarr: List Movies",
      description: `List movies tracked by Radarr as a paged result. Default returns slim fields per movie (${SLIM_MOVIE_FIELDS.join(", ")}); set verbose=true for the full MovieResource. Radarr's upstream /movie returns the entire library in one shot — paging here is server-side, so the upstream load is the same regardless of page. For full details on one movie, use \`radarr_get_movie\`. To find a movie NOT yet tracked, use \`radarr_lookup_movie\` / \`radarr_lookup_tmdb\` / \`radarr_lookup_imdb\`.`,
      inputSchema: {
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Page number, 1-indexed (default 1)."),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .optional()
          .describe(
            `Items per page (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}). If verbose=true, prefer a smaller value to stay under the MCP response cap.`,
          ),
        verbose: z
          .boolean()
          .optional()
          .describe(
            "Return the full MovieResource per item (heavy: overview, images, ratings, movieFile.mediaInfo). Default false returns slim fields only.",
          ),
      },
      annotations: ANN_READ,
    },
    async ({ page = 1, page_size = DEFAULT_PAGE_SIZE, verbose = false }) => {
      const all = (await radarr.listMovies()) as Array<Record<string, unknown>>;
      const projected = verbose
        ? all
        : all.map((m) => pickFields(m, SLIM_MOVIE_FIELDS));
      return asText(paginate(projected, page, page_size));
    },
  );

  server.registerTool(
    "radarr_get_movie",
    {
      title: "Radarr: Get Movie",
      description:
        "Get full details for a Radarr movie by id — overview, ratings, file info, monitored state, collection. Drill-down companion to `radarr_list_movies` and the lookup tools.",
      inputSchema: { id: z.number().int().describe("The Radarr movie ID") },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await radarr.getMovie(id)),
  );

  server.registerTool(
    "radarr_lookup_movie",
    {
      title: "Radarr: Lookup Movie (TMDB)",
      description:
        "Fuzzy search TMDB for a movie to potentially add. Returns MovieResource with `tmdbId` etc., suitable for `radarr_add_movie`. Searches TMDB's catalogue, NOT your tracked library — use `radarr_list_movies` / `radarr_get_movie` for what's already tracked. If you already have a TMDB or IMDB id, prefer the direct `radarr_lookup_tmdb` / `radarr_lookup_imdb` to avoid fuzzy mismatch.",
      inputSchema: { term: z.string().describe("Search term") },
      annotations: ANN_READ_EXT,
    },
    async ({ term }) => asText(await radarr.lookupMovie(term)),
  );

  server.registerTool(
    "radarr_lookup_tmdb",
    {
      title: "Radarr: Lookup Movie by TMDB ID",
      description:
        "Direct lookup of a movie on TMDB by id — use when you already have a TMDB id (e.g. from Plex, Trakt, etc.) instead of fuzzy term search. Returns the same MovieResource shape as `radarr_lookup_movie`, suitable for `radarr_add_movie`.",
      inputSchema: {
        tmdb_id: z.number().int().describe("TMDB movie id"),
      },
      annotations: ANN_READ_EXT,
    },
    async ({ tmdb_id }) => asText(await radarr.lookupTmdb(tmdb_id)),
  );

  server.registerTool(
    "radarr_lookup_imdb",
    {
      title: "Radarr: Lookup Movie by IMDB ID",
      description:
        "Direct lookup of a movie on IMDB by id — use when you already have an IMDB id (e.g. tt0119698) instead of fuzzy term search. Returns the same MovieResource shape as `radarr_lookup_movie`.",
      inputSchema: {
        imdb_id: z
          .string()
          .describe(
            'IMDB id including the "tt" prefix (e.g. "tt0119698" for Princess Mononoke).',
          ),
      },
      annotations: ANN_READ_EXT,
    },
    async ({ imdb_id }) => asText(await radarr.lookupImdb(imdb_id)),
  );

  server.registerTool(
    "radarr_calendar",
    {
      title: "Radarr: Calendar",
      description:
        "Get upcoming/recent movie releases from Radarr's calendar within an ISO date window. Use for 'what's coming out this week?' queries. TV episodes live in `sonarr_calendar`; Lidarr/Readarr/Prowlarr have no calendar surface.",
      inputSchema: {
        start: z.string().optional().describe("ISO date — start of window"),
        end: z.string().optional().describe("ISO date — end of window"),
      },
      annotations: ANN_READ,
    },
    async ({ start, end }) => asText(await radarr.calendar(start, end)),
  );

  server.registerTool(
    "radarr_health",
    {
      title: "Radarr: Health",
      description:
        "Get aggregated Radarr health warnings (indexer down, low disk, etc.). Summary view; for actionable per-indexer failure detail (which indexers, since when, why) use `prowlarr_indexer_status`.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await radarr.health()),
  );

  server.registerTool(
    "radarr_diskspace",
    {
      title: "Radarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Radarr. Useful for 'where do I have room to add this?' decisions; pair with `radarr_list_root_folders` to map paths to capacity.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await radarr.diskspace()),
  );

  server.registerTool(
    "radarr_list_quality_profiles",
    {
      title: "Radarr: List Quality Profiles",
      description:
        "List Radarr quality profiles. The `id` is required as `qualityProfileId` when adding a movie.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await radarr.qualityProfiles()),
  );

  server.registerTool(
    "radarr_list_root_folders",
    {
      title: "Radarr: List Root Folders",
      description:
        "List Radarr root folders (where movies are stored on disk). The `path` is required as `rootFolderPath` when adding a movie.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await radarr.rootFolders()),
  );

  server.registerTool(
    "radarr_list_tags",
    {
      title: "Radarr: List Tags",
      description:
        "List Radarr tags (label + id pairs). Useful for scoping queries by tag (e.g. 'show me everything tagged 4k') and for setting tag ids on add/edit operations.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await radarr.tags()),
  );

  registerQueueTools(server, radarr);
  registerHistoryTools(server, radarr);
  registerWantedTools(server, radarr);
  registerCommandTools(server, radarr);
  registerMovieTools(server, radarr);
  registerReleaseTools(server, radarr);
}
