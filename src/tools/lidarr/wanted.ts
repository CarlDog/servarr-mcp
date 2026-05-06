import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, asText } from "../../clients/base.js";
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
        "List albums that are wanted but not yet downloaded. Filters to monitored items by default. Once you've identified what's missing, trigger an indexer hunt with `lidarr_search_missing`.",
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
      annotations: ANN_READ,
    },
    async ({ page_size, monitored }) =>
      asText(await lidarr.wantedMissing(page_size, monitored)),
  );

  server.registerTool(
    "lidarr_wanted_cutoff",
    {
      title: "Lidarr: Wanted (Below Cutoff)",
      description:
        "List albums downloaded below cutoff quality — upgrade candidates. Filters to monitored items by default. Items here are upgrade candidates; trigger a re-search with `lidarr_search_missing` (which also picks up cutoff-unmet items by default).",
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
      annotations: ANN_READ,
    },
    async ({ page_size, monitored }) =>
      asText(await lidarr.wantedCutoff(page_size, monitored)),
  );
}
