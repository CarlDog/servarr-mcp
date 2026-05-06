import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerWantedTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_wanted_missing",
    {
      title: "Radarr: Wanted (Missing)",
      description:
        "List movies that are wanted but not yet downloaded. Filters to monitored items by default. Once you've identified what's missing, trigger an indexer hunt with `radarr_search_missing`.",
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
      asText(await radarr.wantedMissing(page_size, monitored)),
  );

  server.registerTool(
    "radarr_wanted_cutoff",
    {
      title: "Radarr: Wanted (Below Cutoff)",
      description:
        "List movies downloaded below cutoff quality — upgrade candidates. Filters to monitored items by default. Items here are upgrade candidates; trigger a re-search with `radarr_search_missing` (which also picks up cutoff-unmet items by default).",
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
      asText(await radarr.wantedCutoff(page_size, monitored)),
  );
}
