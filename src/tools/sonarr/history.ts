import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

export function registerHistoryTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_history",
    {
      title: "Sonarr: History",
      description: "Get recent Sonarr history (newest first).",
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
    async ({ page_size }) => asText(await sonarr.history(page_size)),
  );

  server.registerTool(
    "sonarr_history_mark_failed",
    {
      title: "Sonarr: Mark History Failed",
      description:
        "Mark a Sonarr history entry as failed. Triggers Sonarr to re-search for a replacement on the next interval. Useful when an episode imported as the wrong cut/quality/release. Returns a confirmation; no body from the *arr API.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Sonarr history record id (from sonarr_history)."),
      },
    },
    async ({ id }) => {
      await sonarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
