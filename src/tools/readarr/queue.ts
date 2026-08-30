import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ANN_QUEUE_REGRAB,
  ANN_QUEUE_REMOVE,
  ANN_READ,
  asText,
} from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";
import { handleQueueRemove, queueRemoveInputSchema } from "../queue-remove.js";

export function registerQueueTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_queue",
    {
      title: "Readarr: Queue",
      description:
        "Get the current Readarr download queue, paged. Default returns the first 20 records. Bump page_size or step through pages when the queue is large.",
      inputSchema: {
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-indexed page number (default 1)."),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records per page (default 20, max 100)."),
      },
      annotations: ANN_READ,
    },
    async ({ page, page_size }) => asText(await readarr.queue(page, page_size)),
  );

  server.registerTool(
    "readarr_queue_remove",
    {
      title: "Readarr: Remove from Queue",
      description:
        "Remove one Readarr queue item with id, or 1-100 unique items in one server-side request with ids and confirm: true. Bulk processing is not a database transaction and returns no per-id upstream result. remove_from_client safely defaults to false instead of Readarr's destructive true default.",
      inputSchema: queueRemoveInputSchema,
      annotations: ANN_QUEUE_REMOVE,
    },
    async (args) => handleQueueRemove(readarr, args),
  );

  server.registerTool(
    "readarr_queue_regrab",
    {
      title: "Readarr: Re-grab Queue Item",
      description:
        "Force Readarr to re-grab a stuck queue item from the indexer. Useful when a download is hung or the file is corrupt. Returns the updated queue entry.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Readarr queue item id (from readarr_queue)."),
      },
      annotations: ANN_QUEUE_REGRAB,
    },
    async ({ id }) => asText(await readarr.queueRegrab(id)),
  );
}
