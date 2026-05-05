import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerQueueTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_queue",
    {
      title: "Readarr: Queue",
      description: "Get the current Readarr download queue.",
      inputSchema: {},
    },
    async () => asText(await readarr.queue()),
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
    },
    async ({ id }) => asText(await readarr.queueRegrab(id)),
  );
}
