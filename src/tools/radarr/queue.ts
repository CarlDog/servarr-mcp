import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ANN_QUEUE_REGRAB,
  ANN_QUEUE_REMOVE,
  ANN_READ,
  asText,
} from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";
import { handleQueueRemove, queueRemoveInputSchema } from "../queue-remove.js";

export function registerQueueTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_queue",
    {
      title: "Radarr: Queue",
      description:
        "Get the current Radarr download queue, paged. Default returns the first 20 records. Bump page_size or step through pages when the queue is large.",
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
    async ({ page, page_size }) => asText(await radarr.queue(page, page_size)),
  );

  server.registerTool(
    "radarr_queue_remove",
    {
      title: "Radarr: Remove from Queue",
      description:
        "Remove one Radarr queue item with id, or 1-100 unique items in one server-side request with ids and confirm: true. Bulk processing is not a database transaction and returns no per-id upstream result. remove_from_client safely defaults to false instead of Radarr's destructive true default.",
      inputSchema: queueRemoveInputSchema,
      annotations: ANN_QUEUE_REMOVE,
    },
    async (args) => handleQueueRemove(radarr, args),
  );

  server.registerTool(
    "radarr_queue_regrab",
    {
      title: "Radarr: Re-grab Queue Item",
      description:
        "Force Radarr to re-grab a stuck queue item from the indexer. Useful when a download is hung or the file is corrupt. Returns the updated queue entry.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Radarr queue item id (from radarr_queue)."),
      },
      annotations: ANN_QUEUE_REGRAB,
    },
    async ({ id }) => asText(await radarr.queueRegrab(id)),
  );
}
