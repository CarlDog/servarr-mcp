import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

export function registerWantedTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_wanted_missing",
    {
      title: "Lidarr: Wanted (Missing)",
      description:
        "List albums that are wanted but not yet downloaded. Filters to monitored items by default.",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
        monitored: z
          .boolean()
          .optional()
          .describe("Only monitored items (default true)"),
      },
    },
    async ({ page_size, monitored }) =>
      asText(await lidarr.wantedMissing(page_size, monitored)),
  );

  server.registerTool(
    "lidarr_wanted_cutoff",
    {
      title: "Lidarr: Wanted (Below Cutoff)",
      description:
        "List albums downloaded below cutoff quality — upgrade candidates. Filters to monitored items by default.",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
        monitored: z
          .boolean()
          .optional()
          .describe("Only monitored items (default true)"),
      },
    },
    async ({ page_size, monitored }) =>
      asText(await lidarr.wantedCutoff(page_size, monitored)),
  );
}
