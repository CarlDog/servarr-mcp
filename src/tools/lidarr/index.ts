import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";
import { registerArtistTools } from "./artists.js";
import { registerCommandTools } from "./commands.js";
import { registerHistoryTools } from "./history.js";
import { registerQueueTools } from "./queue.js";
import { registerWantedTools } from "./wanted.js";

export function registerLidarrTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_list_artists",
    {
      title: "Lidarr: List Artists",
      description: "List all artists tracked by Lidarr.",
      inputSchema: {},
    },
    async () => asText(await lidarr.listArtists()),
  );

  server.registerTool(
    "lidarr_get_artist",
    {
      title: "Lidarr: Get Artist",
      description: "Get details for a specific Lidarr artist by ID.",
      inputSchema: { id: z.number().int().describe("The Lidarr artist ID") },
    },
    async ({ id }) => asText(await lidarr.getArtist(id)),
  );

  server.registerTool(
    "lidarr_lookup_artist",
    {
      title: "Lidarr: Lookup Artist",
      description: "Search for a new artist to add to Lidarr.",
      inputSchema: { term: z.string().describe("Search term") },
    },
    async ({ term }) => asText(await lidarr.lookupArtist(term)),
  );

  server.registerTool(
    "lidarr_list_albums",
    {
      title: "Lidarr: List Albums",
      description:
        "List albums tracked by Lidarr, optionally filtered to a single artist.",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .optional()
          .describe("Optional artist ID filter"),
      },
    },
    async ({ artist_id }) => asText(await lidarr.listAlbums(artist_id)),
  );


  server.registerTool(
    "lidarr_health",
    {
      title: "Lidarr: Health",
      description:
        "Get aggregated Lidarr health warnings (indexer down, low disk, etc.).",
      inputSchema: {},
    },
    async () => asText(await lidarr.health()),
  );

  server.registerTool(
    "lidarr_diskspace",
    {
      title: "Lidarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Lidarr.",
      inputSchema: {},
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
    },
    async () => asText(await lidarr.rootFolders()),
  );

  registerQueueTools(server, lidarr);
  registerHistoryTools(server, lidarr);
  registerWantedTools(server, lidarr);
  registerCommandTools(server, lidarr);
  registerArtistTools(server, lidarr);
}
