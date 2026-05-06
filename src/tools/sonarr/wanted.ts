import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

export function registerWantedTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_wanted_missing",
    {
      title: "Sonarr: Wanted (Missing)",
      description:
        "List episodes that are wanted but not yet downloaded. Filters to monitored items by default.",
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
      asText(await sonarr.wantedMissing(page_size, monitored)),
  );

  server.registerTool(
    "sonarr_wanted_cutoff",
    {
      title: "Sonarr: Wanted (Below Cutoff)",
      description:
        "List episodes downloaded below cutoff quality — upgrade candidates. Filters to monitored items by default.",
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
      asText(await sonarr.wantedCutoff(page_size, monitored)),
  );
}
