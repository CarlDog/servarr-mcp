import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

export function registerReleaseTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_release_search",
    {
      title: "Lidarr: Release Search",
      description:
        "Run a live indexer search for releases of a specific artist or album and return candidate ReleaseResource entries (without grabbing). Hits every enabled indexer in real time — slow and rate-limit-sensitive, so call only when the user wants to pick a release manually. At least one of `artist_id` or `album_id` is required. Returned items feed `lidarr_grab_release` (when it ships).",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Lidarr artist id (from lidarr_list_artists). Scopes the search to that artist's discography.",
          ),
        album_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Lidarr album id (from lidarr_list_albums). Scopes to a single album.",
          ),
      },
    },
    async ({ artist_id, album_id }) => {
      if (artist_id === undefined && album_id === undefined) {
        throw new Error(
          "lidarr_release_search requires artist_id or album_id — an unscoped /release call hits every indexer.",
        );
      }
      return asText(
        await lidarr.searchReleases({
          artistId: artist_id,
          albumId: album_id,
        }),
      );
    },
  );
}
