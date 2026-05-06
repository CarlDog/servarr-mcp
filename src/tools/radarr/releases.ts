import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerReleaseTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_release_search",
    {
      title: "Radarr: Release Search",
      description:
        "Run a live indexer search for releases of a specific movie and return candidate ReleaseResource entries (without grabbing). Hits every enabled indexer in real time — slow and rate-limit-sensitive, so call only when the user wants to pick a release manually. Returned items feed `radarr_grab_release` (when it ships).",
      inputSchema: {
        movie_id: z
          .number()
          .int()
          .describe("The Radarr movie id (from radarr_list_movies)."),
      },
    },
    async ({ movie_id }) =>
      asText(await radarr.searchReleases({ movieId: movie_id })),
  );
}
