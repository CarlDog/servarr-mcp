import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_ADD, ANN_EDIT, asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";
import {
  applyServarrPathEdit,
  assertServarrPathEditApplied,
} from "../edit-path.js";

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
      annotations: ANN_ADD,
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

  server.registerTool(
    "lidarr_edit_artist",
    {
      title: "Lidarr: Edit Artist",
      description:
        "Edit settings on an existing Lidarr artist. Internally GETs the current ArtistResource, applies your changes, and PUTs the full resource back. Pass only the fields you want to change — others are preserved. " +
        "root_folder_path rebases the artist's existing leaf folder under the new root and sends the derived full path explicitly; path overrides that derivation with an exact full on-disk folder path. The tool verifies the returned ArtistResource reports the requested path instead of accepting a silent no-op. Either can trigger a file move — controlled by move_files, which this tool always passes explicitly and defaults to false, so a metadata-only correction with move_files left at its default never touches files on disk. Set move_files: true only when you intend an actual relocation.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Lidarr artist id (from lidarr_list_artists)."),
        monitored: z
          .boolean()
          .optional()
          .describe(
            "Toggle whether Lidarr tracks this artist for new releases.",
          ),
        quality_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the quality profile (from lidarr_list_quality_profiles).",
          ),
        metadata_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the metadata profile (from lidarr_list_metadata_profiles).",
          ),
        root_folder_path: z
          .string()
          .optional()
          .describe(
            "Change the root folder (from lidarr_list_root_folders). The tool preserves the current leaf folder name, derives the full destination path under this root, and sends both fields. See move_files.",
          ),
        path: z
          .string()
          .optional()
          .describe(
            "Set the artist's exact full on-disk folder path instead of deriving it from root_folder_path. Use for metadata-only corrections (e.g. a case or mount-alias fix) — combine with the default move_files: false so Lidarr updates its record without touching files.",
          ),
        move_files: z
          .boolean()
          .optional()
          .describe(
            "Whether a root_folder_path or path change should physically move files on disk. Defaults to false — always passed explicitly rather than relying on Lidarr's own default. Set true only to perform an actual relocation.",
          ),
        tags: z
          .array(z.number().int())
          .optional()
          .describe(
            "Replace the tag id list (from lidarr_list_tags). Full replacement, not append.",
          ),
      },
      annotations: ANN_EDIT,
    },
    async ({
      id,
      monitored,
      quality_profile_id,
      metadata_profile_id,
      root_folder_path,
      path,
      move_files,
      tags,
    }) => {
      const current = (await lidarr.getArtist(id)) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };
      if (monitored !== undefined) updated.monitored = monitored;
      if (quality_profile_id !== undefined) {
        updated.qualityProfileId = quality_profile_id;
      }
      if (metadata_profile_id !== undefined) {
        updated.metadataProfileId = metadata_profile_id;
      }
      const expectedPath = applyServarrPathEdit(updated, {
        rootFolderPath: root_folder_path,
        path,
        resourceName: "Lidarr artist",
      });
      if (tags !== undefined) updated.tags = tags;
      const result = await lidarr.editArtist(id, updated, move_files ?? false);
      assertServarrPathEditApplied(result, expectedPath, "Lidarr artist");
      return asText(result);
    },
  );
}
