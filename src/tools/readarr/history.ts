import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_MARK_FAILED, ANN_READ, asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerHistoryTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_history",
    {
      title: "Readarr: History",
      description:
        "Get recent Readarr history (newest first). For per-resource scope use `readarr_history_author`. To re-trigger a search for a wrong-grab event, use `readarr_history_mark_failed`.",
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
    async ({ page_size }) => asText(await readarr.history(page_size)),
  );

  server.registerTool(
    "readarr_history_author",
    {
      title: "Readarr: Author History",
      description:
        "Get history scoped to a single author — every grab/import/upgrade/delete event for that author's bibliography. Much narrower than `readarr_history`, which is server-wide.",
      inputSchema: {
        author_id: z.number().int().describe("The Readarr author ID."),
      },
      annotations: ANN_READ,
    },
    async ({ author_id }) => asText(await readarr.historyAuthor(author_id)),
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
          .describe(
            "The Readarr history record id (from readarr_history or readarr_history_author).",
          ),
      },
      annotations: ANN_MARK_FAILED,
    },
    async ({ id }) => {
      await readarr.markHistoryFailed(id);
      return asText({ marked_failed: true, id });
    },
  );
}
