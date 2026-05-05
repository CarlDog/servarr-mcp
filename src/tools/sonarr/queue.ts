import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

export function registerQueueTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_queue",
    {
      title: "Sonarr: Queue",
      description: "Get the current Sonarr download queue.",
      inputSchema: {},
    },
    async () => asText(await sonarr.queue()),
  );

  server.registerTool(
    "sonarr_queue_remove",
    {
      title: "Sonarr: Remove from Queue",
      description:
        "Remove a single item from Sonarr's download queue. All four flags are exposed because the server-side defaults are not obviously safe — in particular, removeFromClient defaults to true on Sonarr's side, which deletes the file from the download client. This tool defaults remove_from_client to false; flip it explicitly if you want the file gone.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Sonarr queue item id (from sonarr_queue)."),
        remove_from_client: z
          .boolean()
          .optional()
          .describe(
            "Tell the download client to delete the download too (default false — flips Sonarr's destructive server-side default of true).",
          ),
        blocklist: z
          .boolean()
          .optional()
          .describe(
            "Add the release to the blocklist so Sonarr doesn't re-grab it (default false).",
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
            "Move the download to the recycle/'tv-recycle' category in the client (if configured) instead of deleting (default false).",
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
      await sonarr.queueRemove(id, opts);
      return asText({ removed: true, id, options: opts });
    },
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
    },
    async ({ id }) => asText(await sonarr.queueRegrab(id)),
  );
}
