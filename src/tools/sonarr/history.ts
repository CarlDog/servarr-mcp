import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_MARK_FAILED, ANN_READ, asText } from "../../clients/base.js";
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
      annotations: ANN_READ,
    },
    async ({ page_size }) => asText(await sonarr.history(page_size)),
  );

  server.registerTool(
    "sonarr_history_series",
    {
      title: "Sonarr: Series History",
      description:
        "Get history scoped to a single series — every grab/import/upgrade/delete event. Much narrower than `sonarr_history`, which is server-wide and routinely runs into hundreds of thousands of records.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID."),
      },
      annotations: ANN_READ,
    },
    async ({ series_id }) => asText(await sonarr.historySeries(series_id)),
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
      annotations: ANN_MARK_FAILED,
    },
    async ({ id }) => {
      await sonarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
