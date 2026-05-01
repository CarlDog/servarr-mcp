import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerWantedTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_wanted_missing",
    {
      title: "Readarr: Wanted (Missing)",
      description:
        "List books that are wanted but not yet downloaded. Filters to monitored items by default.",
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
      asText(await readarr.wantedMissing(page_size, monitored)),
  );

  server.registerTool(
    "readarr_wanted_cutoff",
    {
      title: "Readarr: Wanted (Below Cutoff)",
      description:
        "List books downloaded below cutoff quality — upgrade candidates. Filters to monitored items by default.",
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
      asText(await readarr.wantedCutoff(page_size, monitored)),
  );
}
