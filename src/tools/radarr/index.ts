import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";
import { registerCommandTools } from "./commands.js";
import { registerMovieTools } from "./movies.js";
import { registerQueueTools } from "./queue.js";
import { registerWantedTools } from "./wanted.js";

export function registerRadarrTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_list_movies",
    {
      title: "Radarr: List Movies",
      description: "List all movies tracked by Radarr.",
      inputSchema: {},
    },
    async () => asText(await radarr.listMovies()),
  );

  server.registerTool(
    "radarr_get_movie",
    {
      title: "Radarr: Get Movie",
      description: "Get details for a specific Radarr movie by ID.",
      inputSchema: { id: z.number().int().describe("The Radarr movie ID") },
    },
    async ({ id }) => asText(await radarr.getMovie(id)),
  );

  server.registerTool(
    "radarr_lookup_movie",
    {
      title: "Radarr: Lookup Movie (TMDB)",
      description: "Search TMDB for a new movie to add to Radarr.",
      inputSchema: { term: z.string().describe("Search term") },
    },
    async ({ term }) => asText(await radarr.lookupMovie(term)),
  );

  server.registerTool(
    "radarr_calendar",
    {
      title: "Radarr: Calendar",
      description: "Get upcoming movie releases from the Radarr calendar.",
      inputSchema: {
        start: z.string().optional().describe("ISO date — start of window"),
        end: z.string().optional().describe("ISO date — end of window"),
      },
    },
    async ({ start, end }) => asText(await radarr.calendar(start, end)),
  );

  server.registerTool(
    "radarr_history",
    {
      title: "Radarr: History",
      description: "Get recent Radarr history (newest first).",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
      },
    },
    async ({ page_size }) => asText(await radarr.history(page_size)),
  );

  server.registerTool(
    "radarr_health",
    {
      title: "Radarr: Health",
      description:
        "Get aggregated Radarr health warnings (indexer down, low disk, etc.).",
      inputSchema: {},
    },
    async () => asText(await radarr.health()),
  );

  server.registerTool(
    "radarr_diskspace",
    {
      title: "Radarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Radarr.",
      inputSchema: {},
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
    },
    async () => asText(await radarr.rootFolders()),
  );

  registerQueueTools(server, radarr);
  registerWantedTools(server, radarr);
  registerCommandTools(server, radarr);
  registerMovieTools(server, radarr);
}
