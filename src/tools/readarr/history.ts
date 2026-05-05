import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerHistoryTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_history",
    {
      title: "Readarr: History",
      description: "Get recent Readarr history (newest first).",
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
    async ({ page_size }) => asText(await readarr.history(page_size)),
  );

  server.registerTool(
    "readarr_history_mark_failed",
    {
      title: "Readarr: Mark History Failed",
      description:
        "Mark a Readarr history entry as failed. Triggers Readarr to re-search for a replacement on the next interval. Useful when a book imported as the wrong edition/release. Returns a confirmation; no body from the *arr API.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Readarr history record id (from readarr_history)."),
      },
    },
    async ({ id }) => {
      await readarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
