import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

// Lidarr artist-monitor options (subset that makes sense to expose).
const ArtistMonitorOption = z.enum([
  "all",
  "future",
  "missing",
  "existing",
  "first",
  "latest",
  "none",
]);

export function registerArtistTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_add_artist",
    {
      title: "Lidarr: Add Artist",
      description:
        "Add a new artist to Lidarr by MusicBrainz Artist ID (MBID). Internally calls /artist/lookup to fetch the full ArtistResource, then POSTs /artist with the merged body. Returns the created ArtistResource. " +
        "Workflow: call lidarr_lookup_artist first to get the foreignArtistId (MBID), lidarr_list_quality_profiles for quality_profile_id, lidarr_list_metadata_profiles for metadata_profile_id, lidarr_list_root_folders for root_folder_path. " +
        "Note: search_for_missing_albums defaults to false here — Lidarr's server-side default is true, which may immediately hit indexers; flip explicitly if you want that.",
      inputSchema: {
        foreign_artist_id: z
          .string()
          .describe(
            "The MusicBrainz Artist ID (UUID) of the artist to add (from lidarr_lookup_artist).",
          ),
        quality_profile_id: z
          .number()
          .int()
          .describe("Quality profile id (from lidarr_list_quality_profiles)."),
        metadata_profile_id: z
          .number()
          .int()
          .describe(
            "Metadata profile id (from lidarr_list_metadata_profiles).",
          ),
        root_folder_path: z
          .string()
          .describe("Root folder path (from lidarr_list_root_folders)."),
        monitored: z
          .boolean()
          .optional()
          .describe("Track this artist for missing albums (default true)."),
        monitor: ArtistMonitorOption.optional().describe(
          "Which albums to monitor on add (default 'all').",
        ),
        search_for_missing_albums: z
          .boolean()
          .optional()
          .describe(
            "Trigger a search for missing albums immediately on add (default false).",
          ),
      },
    },
    async ({
      foreign_artist_id,
      quality_profile_id,
      metadata_profile_id,
      root_folder_path,
      monitored = true,
      monitor = "all",
      search_for_missing_albums = false,
    }) => {
      const lookup = (await lidarr.lookupArtist(
        `lidarr:${foreign_artist_id}`,
      )) as Array<Record<string, unknown>>;
      if (!Array.isArray(lookup) || lookup.length === 0) {
        throw new Error(
          `Lidarr lookup returned no results for MBID ${foreign_artist_id}.`,
        );
      }
      const artist = lookup[0];
      const body = {
        ...artist,
        qualityProfileId: quality_profile_id,
        metadataProfileId: metadata_profile_id,
        rootFolderPath: root_folder_path,
        monitored,
        addOptions: {
          monitor,
          searchForMissingAlbums: search_for_missing_albums,
        },
      };
      return asText(await lidarr.addArtist(body));
    },
  );
}
