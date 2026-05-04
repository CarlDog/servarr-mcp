import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerCommandTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_search_missing",
    {
      title: "Radarr: Search Missing Movies",
      description:
        "Trigger Radarr to search indexers for all monitored, missing movies. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Radarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await radarr.triggerCommand("MissingMoviesSearch")),
  );

  server.registerTool(
    "radarr_refresh_movie",
    {
      title: "Radarr: Refresh Movie Metadata",
      description:
        "Trigger Radarr to re-pull metadata from TMDB for one or more movies. Async — returns the queued CommandResource.",
      inputSchema: {
        movie_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Radarr movie IDs to refresh."),
      },
    },
    async ({ movie_ids }) =>
      asText(
        await radarr.triggerCommand("RefreshMovie", { movieIds: movie_ids }),
      ),
  );
}
