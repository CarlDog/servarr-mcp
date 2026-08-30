import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ANN_QUEUE_REGRAB,
  ANN_QUEUE_REMOVE,
  ANN_READ,
  asText,
} from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";
import { projectQueuePage } from "../list-projection.js";
import { handleQueueRemove, queueRemoveInputSchema } from "../queue-remove.js";

export function registerQueueTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_queue",
    {
      title: "Sonarr: Queue",
      description:
        "Get the current Sonarr download queue, paged. Default returns compact identity/state/error fields while preserving statusMessages; set verbose=true for full queue resources including quality and custom-format detail.",
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
        verbose: z.boolean().optional().describe("Return full queue records."),
      },
      annotations: ANN_READ,
    },
    async ({ page, page_size, verbose = false }) => {
      const queue = await sonarr.queue(page, page_size);
      return asText(
        verbose
          ? queue
          : projectQueuePage(queue, [
              "seriesId",
              "episodeId",
              "seasonNumber",
              "episodeHasFile",
            ]),
      );
    },
  );

  server.registerTool(
    "sonarr_queue_remove",
    {
      title: "Sonarr: Remove from Queue",
      description:
        "Remove one Sonarr queue item with id, or 1-100 unique items in one server-side request with ids and confirm: true. Bulk processing is not a database transaction and returns no per-id upstream result. remove_from_client safely defaults to false instead of Sonarr's destructive true default.",
      inputSchema: queueRemoveInputSchema,
      annotations: ANN_QUEUE_REMOVE,
    },
    async (args) => handleQueueRemove(sonarr, args),
  );

  server.registerTool(
    "sonarr_queue_regrab",
    {
      title: "Sonarr: Re-grab Queue Item",
      description:
        "Force Sonarr to re-grab a stuck queue item from the indexer. Useful when a download is hung or the file is corrupt. Returns the updated queue entry.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Sonarr queue item id (from sonarr_queue)."),
      },
      annotations: ANN_QUEUE_REGRAB,
    },
    async ({ id }) => asText(await sonarr.queueRegrab(id)),
  );
}
