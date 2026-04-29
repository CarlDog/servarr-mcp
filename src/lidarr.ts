import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServarrClient, asText } from "./base.js";

export class LidarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v1", appName: "Lidarr" });
  }

  async listArtists(): Promise<unknown> {
    return this.request("/artist");
  }

  async getArtist(id: number): Promise<unknown> {
    return this.request(`/artist/${id}`);
  }

  async lookupArtist(term: string): Promise<unknown> {
    return this.request("/artist/lookup", { term });
  }

  async listAlbums(artistId?: number): Promise<unknown> {
    if (artistId === undefined) {
      return this.request("/album");
    }
    return this.request("/album", { artistId });
  }
}

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
    "lidarr_queue",
    {
      title: "Lidarr: Queue",
      description: "Get the current Lidarr download queue.",
      inputSchema: {},
    },
    async () => asText(await lidarr.queue()),
  );

  server.registerTool(
    "lidarr_history",
    {
      title: "Lidarr: History",
      description: "Get recent Lidarr history (newest first).",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
      },
    },
    async ({ page_size }) => asText(await lidarr.history(page_size)),
  );
}
