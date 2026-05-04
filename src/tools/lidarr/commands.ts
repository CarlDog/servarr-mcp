import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

export function registerCommandTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_search_missing",
    {
      title: "Lidarr: Search Missing Albums",
      description:
        "Trigger Lidarr to search indexers for all monitored, missing albums. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Lidarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await lidarr.triggerCommand("MissingAlbumSearch")),
  );

  server.registerTool(
    "lidarr_refresh_artist",
    {
      title: "Lidarr: Refresh Artist Metadata",
      description:
        "Trigger Lidarr to re-pull metadata from MusicBrainz for one artist (discography, artwork). Async — returns the queued CommandResource.",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .describe("The Lidarr artist ID to refresh."),
      },
    },
    async ({ artist_id }) =>
      asText(
        await lidarr.triggerCommand("RefreshArtist", { artistId: artist_id }),
      ),
  );
}
