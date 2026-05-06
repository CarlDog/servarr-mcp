import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_COMMAND, ANN_READ, asText } from "../../clients/base.js";
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
        "Trigger Lidarr to search indexers for all monitored, missing albums. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll status with `lidarr_get_command` (use the returned id).",
      inputSchema: {},
      annotations: ANN_COMMAND,
    },
    async () => asText(await lidarr.triggerCommand("MissingAlbumSearch")),
  );

  server.registerTool(
    "lidarr_refresh_artist",
    {
      title: "Lidarr: Refresh Artist Metadata",
      description:
        "Trigger Lidarr to re-pull metadata from MusicBrainz for one artist (discography, artwork). Async — returns the queued CommandResource. Poll status with `lidarr_get_command` (use the returned id).",
      inputSchema: {
        artist_id: z
          .number()
          .int()
          .describe("The Lidarr artist ID to refresh."),
      },
      annotations: ANN_COMMAND,
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
        "Trigger Lidarr to search indexers for all monitored, missing albums of one artist. Async — returns the queued CommandResource. Poll status with `lidarr_get_command` (use the returned id).",
      inputSchema: {
        artist_id: z.number().int().describe("The Lidarr artist ID to search."),
      },
      annotations: ANN_COMMAND,
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
        "Trigger Lidarr to search indexers for one or more specific albums. Async — returns the queued CommandResource. Poll status with `lidarr_get_command` (use the returned id).",
      inputSchema: {
        album_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Lidarr album IDs to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ album_ids }) =>
      asText(
        await lidarr.triggerCommand("AlbumSearch", { albumIds: album_ids }),
      ),
  );

  server.registerTool(
    "lidarr_get_command",
    {
      title: "Lidarr: Get Command Status",
      description:
        "Poll the status of an async command queued by lidarr_search_*, lidarr_refresh_artist, etc. Returns the current CommandResource (status: queued|started|completed|failed, exception, started/ended timestamps).",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe(
            "The command id returned by the trigger tool (CommandResource.id).",
          ),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await lidarr.getCommand(id)),
  );
}
