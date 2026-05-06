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

  server.registerTool(
    "lidarr_search_artist",
    {
      title: "Lidarr: Search Artist",
      description:
        "Trigger Lidarr to search indexers for all monitored, missing albums of one artist. Async — returns the queued CommandResource.",
      inputSchema: {
        artist_id: z.number().int().describe("The Lidarr artist ID to search."),
      },
    },
    async ({ artist_id }) =>
      asText(
        await lidarr.triggerCommand("ArtistSearch", { artistId: artist_id }),
      ),
  );

  server.registerTool(
    "lidarr_search_album",
    {
      title: "Lidarr: Search Albums",
      description:
        "Trigger Lidarr to search indexers for one or more specific albums. Async — returns the queued CommandResource.",
      inputSchema: {
        album_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Lidarr album IDs to search."),
      },
    },
    async ({ album_ids }) =>
      asText(
        await lidarr.triggerCommand("AlbumSearch", { albumIds: album_ids }),
      ),
  );
}
