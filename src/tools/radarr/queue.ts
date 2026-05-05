import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerQueueTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_queue",
    {
      title: "Radarr: Queue",
      description: "Get the current Radarr download queue.",
      inputSchema: {},
    },
    async () => asText(await radarr.queue()),
  );

  server.registerTool(
    "radarr_queue_remove",
    {
      title: "Radarr: Remove from Queue",
      description:
        "Remove a single item from Radarr's download queue. All four flags are exposed because the server-side defaults are not obviously safe — in particular, removeFromClient defaults to true on Radarr's side, which deletes the file from the download client. This tool defaults remove_from_client to false; flip it explicitly if you want the file gone.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Radarr queue item id (from radarr_queue)."),
        remove_from_client: z
          .boolean()
          .optional()
          .describe(
            "Tell the download client to delete the download too (default false — flips Radarr's destructive server-side default of true).",
          ),
        blocklist: z
          .boolean()
          .optional()
          .describe(
            "Add the release to the blocklist so Radarr doesn't re-grab it (default false).",
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
            "Move the download to the recycle/'movies-recycle' category in the client (if configured) instead of deleting (default false).",
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
      await radarr.queueRemove(id, opts);
      return asText({ removed: true, id, options: opts });
    },
  );
}
