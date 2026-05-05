import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
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
    },
    async ({ page_size }) => asText(await lidarr.history(page_size)),
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
    },
    async ({ id }) => {
      await lidarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
