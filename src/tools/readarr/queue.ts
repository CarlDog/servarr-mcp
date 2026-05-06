import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ANN_QUEUE_REGRAB,
  ANN_QUEUE_REMOVE,
  ANN_READ,
  asText,
} from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

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
        "Remove a single item from Readarr's download queue. All four flags are exposed because the server-side defaults are not obviously safe — in particular, removeFromClient defaults to true on Readarr's side, which deletes the file from the download client. This tool defaults remove_from_client to false; flip it explicitly if you want the file gone.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Readarr queue item id (from readarr_queue)."),
        remove_from_client: z
          .boolean()
          .optional()
          .describe(
            "Tell the download client to delete the download too (default false — flips Readarr's destructive server-side default of true).",
          ),
        blocklist: z
          .boolean()
          .optional()
          .describe(
            "Add the release to the blocklist so Readarr doesn't re-grab it (default false).",
          ),
        skip_redownload: z
          .boolean()
          .optional()
          .describe(
            "Don't trigger a re-search for a replacement (default false).",
          ),
        change_category: z
          .boolean()
          .optional()
          .describe(
            "Move the download to the recycle category in the client (if configured) instead of deleting (default false).",
          ),
      },
      annotations: ANN_QUEUE_REMOVE,
    },
    async ({
      id,
      remove_from_client = false,
      blocklist = false,
      skip_redownload = false,
      change_category = false,
    }) => {
      const opts = {
        removeFromClient: remove_from_client,
        blocklist,
        skipRedownload: skip_redownload,
        changeCategory: change_category,
      };
      await readarr.queueRemove(id, opts);
      return asText({ removed: true, id, options: opts });
    },
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
