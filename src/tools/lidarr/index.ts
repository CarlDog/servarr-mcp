import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, ANN_READ_EXT, asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";
import { registerArtistTools } from "./artists.js";
import { registerCommandTools } from "./commands.js";
import { registerHistoryTools } from "./history.js";
import { registerQueueTools } from "./queue.js";
import { registerReleaseTools } from "./releases.js";
import { registerWantedTools } from "./wanted.js";

export function registerLidarrTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_list_artists",
    {
      title: "Lidarr: List Artists",
      description:
        "List every artist tracked by Lidarr (id, name, monitored state, album/track counts). Use to scan or filter the library; for one specific artist use `lidarr_get_artist`. To find an artist NOT yet tracked, use `lidarr_lookup_artist` (MusicBrainz metadata).",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.listArtists()),
  );

  server.registerTool(
    "lidarr_get_artist",
    {
      title: "Lidarr: Get Artist",
      description:
        "Get full details for a Lidarr artist by id — overview, profile, monitored state, statistics. Drill-down companion to `lidarr_list_artists` and `lidarr_lookup_artist`.",
      inputSchema: { id: z.number().int().describe("The Lidarr artist ID") },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await lidarr.getArtist(id)),
  );

  server.registerTool(
    "lidarr_lookup_artist",
    {
      title: "Lidarr: Lookup Artist (MusicBrainz)",
      description:
        "Fuzzy search MusicBrainz for an artist to potentially add. Returns ArtistResource with `foreignArtistId` etc., suitable for `lidarr_add_artist`. Searches MusicBrainz's catalogue, NOT your tracked library — use `lidarr_list_artists` / `lidarr_get_artist` for what's already tracked.",
      inputSchema: { term: z.string().describe("Search term") },
      annotations: ANN_READ_EXT,
    },
    async ({ term }) => asText(await lidarr.lookupArtist(term)),
  );

  server.registerTool(
    "lidarr_list_albums",
    {
      title: "Lidarr: List Albums",
      description:
        "List albums tracked by Lidarr, optionally filtered to a single artist. Returns album ids you can drill into with `lidarr_get_album` or pass to `lidarr_release_search`.",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .optional()
          .describe("Optional artist ID filter"),
      },
      annotations: ANN_READ,
    },
    async ({ artist_id }) => asText(await lidarr.listAlbums(artist_id)),
  );

  server.registerTool(
    "lidarr_get_album",
    {
      title: "Lidarr: Get Album",
      description:
        "Get full details for a single Lidarr album by ID — release date, track list, monitored state, etc.",
      inputSchema: {
        id: z.number().int().describe("The Lidarr album ID"),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await lidarr.getAlbum(id)),
  );

  server.registerTool(
    "lidarr_get_track",
    {
      title: "Lidarr: Get Track",
      description:
        "Get full details for a single Lidarr track by ID — duration, track number, file info, etc.",
      inputSchema: {
        id: z.number().int().describe("The Lidarr track ID"),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await lidarr.getTrack(id)),
  );

  server.registerTool(
    "lidarr_list_trackfiles",
    {
      title: "Lidarr: List Track Files",
      description:
        "List Lidarr track files (the actual audio files on disk). Optionally filter by artist_id, album_id, or unmapped (orphan files Lidarr knows about but hasn't matched to a track). The unmapped=true mode is the standard 'find orphans on disk' query — pairs naturally with filesystem inspection of the music root to reconcile what's on disk vs. what Lidarr is tracking.",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .optional()
          .describe("Optional Lidarr artist id to scope the listing."),
        album_id: z
          .number()
          .int()
          .optional()
          .describe("Optional Lidarr album id to scope the listing."),
        unmapped: z
          .boolean()
          .optional()
          .describe(
            "When true, return only orphan files (on disk but not linked to any track).",
          ),
      },
      annotations: ANN_READ,
    },
    async ({ artist_id, album_id, unmapped }) =>
      asText(
        await lidarr.listTrackfiles({
          artistId: artist_id,
          albumId: album_id,
          unmapped,
        }),
      ),
  );

  server.registerTool(
    "lidarr_health",
    {
      title: "Lidarr: Health",
      description:
        "Get aggregated Lidarr health warnings (indexer down, low disk, etc.). Summary view; for actionable per-indexer failure detail use `prowlarr_indexer_status`.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.health()),
  );

  server.registerTool(
    "lidarr_diskspace",
    {
      title: "Lidarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Lidarr. Useful for 'where do I have room to add this?' decisions; pair with `lidarr_list_root_folders` to map paths to capacity.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.diskspace()),
  );

  server.registerTool(
    "lidarr_list_quality_profiles",
    {
      title: "Lidarr: List Quality Profiles",
      description:
        "List Lidarr quality profiles. The `id` is required as `qualityProfileId` when adding an artist.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.qualityProfiles()),
  );

  server.registerTool(
    "lidarr_list_metadata_profiles",
    {
      title: "Lidarr: List Metadata Profiles",
      description:
        "List Lidarr metadata profiles (controls which releases qualify per artist). The `id` is required as `metadataProfileId` when adding an artist.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.metadataProfiles()),
  );

  server.registerTool(
    "lidarr_list_root_folders",
    {
      title: "Lidarr: List Root Folders",
      description:
        "List Lidarr root folders (where music is stored on disk). The `path` is required as `rootFolderPath` when adding an artist.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.rootFolders()),
  );

  server.registerTool(
    "lidarr_list_tags",
    {
      title: "Lidarr: List Tags",
      description:
        "List Lidarr tags (label + id pairs). Useful for scoping queries by tag and for setting tag ids on add/edit operations.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await lidarr.tags()),
  );

  registerQueueTools(server, lidarr);
  registerHistoryTools(server, lidarr);
  registerWantedTools(server, lidarr);
  registerCommandTools(server, lidarr);
  registerArtistTools(server, lidarr);
  registerReleaseTools(server, lidarr);
}
