import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_MARK_FAILED, ANN_READ, asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

export function registerHistoryTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_history",
    {
      title: "Lidarr: History",
      description: "Get recent Lidarr history (newest first).",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
      },
      annotations: ANN_READ,
    },
    async ({ page_size }) => asText(await lidarr.history(page_size)),
  );

  server.registerTool(
    "lidarr_history_artist",
    {
      title: "Lidarr: Artist History",
      description:
        "Get history scoped to a single artist — every grab/import/upgrade/delete event for that artist's discography. Much narrower than `lidarr_history`, which is server-wide.",
      inputSchema: {
        artist_id: z.number().int().describe("The Lidarr artist ID."),
      },
      annotations: ANN_READ,
    },
    async ({ artist_id }) => asText(await lidarr.historyArtist(artist_id)),
  );

  server.registerTool(
    "lidarr_history_mark_failed",
    {
      title: "Lidarr: Mark History Failed",
      description:
        "Mark a Lidarr history entry as failed. Triggers Lidarr to re-search for a replacement on the next interval. Useful when a track/album imported as the wrong release. Returns a confirmation; no body from the *arr API.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Lidarr history record id (from lidarr_history)."),
      },
      annotations: ANN_MARK_FAILED,
    },
    async ({ id }) => {
      await lidarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
