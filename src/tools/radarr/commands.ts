import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_COMMAND, ANN_READ, asText } from "../../clients/base.js";
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
      annotations: ANN_COMMAND,
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
      annotations: ANN_COMMAND,
    },
    async ({ movie_ids }) =>
      asText(
        await radarr.triggerCommand("RefreshMovie", { movieIds: movie_ids }),
      ),
  );

  server.registerTool(
    "radarr_search_movie",
    {
      title: "Radarr: Search Movies",
      description:
        "Trigger Radarr to search indexers for one or more specific movies. Async — returns the queued CommandResource.",
      inputSchema: {
        movie_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Radarr movie IDs to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ movie_ids }) =>
      asText(
        await radarr.triggerCommand("MoviesSearch", { movieIds: movie_ids }),
      ),
  );

  server.registerTool(
    "radarr_get_command",
    {
      title: "Radarr: Get Command Status",
      description:
        "Poll the status of an async command queued by radarr_search_*, radarr_refresh_movie, etc. Returns the current CommandResource (status: queued|started|completed|failed, exception, started/ended timestamps).",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe(
            "The command id returned by the trigger tool (CommandResource.id).",
          ),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await radarr.getCommand(id)),
  );
}
