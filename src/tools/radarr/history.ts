import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerHistoryTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
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
    "radarr_history_movie",
    {
      title: "Radarr: Movie History",
      description:
        "Get history scoped to a single movie — every grab/import/upgrade/delete event. Much narrower than `radarr_history`, which is server-wide and runs into thousands of records.",
      inputSchema: {
        movie_id: z.number().int().describe("The Radarr movie ID."),
      },
    },
    async ({ movie_id }) => asText(await radarr.historyMovie(movie_id)),
  );

  server.registerTool(
    "radarr_history_mark_failed",
    {
      title: "Radarr: Mark History Failed",
      description:
        "Mark a Radarr history entry as failed. Triggers Radarr to re-search for a replacement on the next interval. Useful when a movie imported as the wrong cut/quality/release. Returns a confirmation; no body from the *arr API.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Radarr history record id (from radarr_history)."),
      },
    },
    async ({ id }) => {
      await radarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
