import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServarrClient, asText } from "./base.js";

export class SonarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v3", appName: "Sonarr" });
  }

  async listSeries(): Promise<unknown> {
    return this.request("/series");
  }

  async getSeries(id: number): Promise<unknown> {
    return this.request(`/series/${id}`);
  }

  async lookupSeries(term: string): Promise<unknown> {
    return this.request("/series/lookup", { term });
  }

  async listEpisodes(seriesId: number): Promise<unknown> {
    return this.request("/episode", { seriesId });
  }

  async calendar(start?: string, end?: string): Promise<unknown> {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return this.request("/calendar", params);
  }
}

export function registerSonarrTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_list_series",
    {
      title: "Sonarr: List Series",
      description: "List all TV series tracked by Sonarr.",
      inputSchema: {},
    },
    async () => asText(await sonarr.listSeries()),
  );

  server.registerTool(
    "sonarr_get_series",
    {
      title: "Sonarr: Get Series",
      description: "Get details for a specific Sonarr series by ID.",
      inputSchema: { id: z.number().int().describe("The Sonarr series ID") },
    },
    async ({ id }) => asText(await sonarr.getSeries(id)),
  );

  server.registerTool(
    "sonarr_lookup_series",
    {
      title: "Sonarr: Lookup Series (TVDB)",
      description: "Search TVDB for a new series to add to Sonarr.",
      inputSchema: { term: z.string().describe("Search term") },
    },
    async ({ term }) => asText(await sonarr.lookupSeries(term)),
  );

  server.registerTool(
    "sonarr_list_episodes",
    {
      title: "Sonarr: List Episodes",
      description: "List all episodes for a given Sonarr series.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID"),
      },
    },
    async ({ series_id }) => asText(await sonarr.listEpisodes(series_id)),
  );

  server.registerTool(
    "sonarr_calendar",
    {
      title: "Sonarr: Calendar",
      description: "Get upcoming episodes from the Sonarr calendar.",
      inputSchema: {
        start: z.string().optional().describe("ISO date — start of window"),
        end: z.string().optional().describe("ISO date — end of window"),
      },
    },
    async ({ start, end }) => asText(await sonarr.calendar(start, end)),
  );

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
    "sonarr_history",
    {
      title: "Sonarr: History",
      description: "Get recent Sonarr history (newest first).",
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
    async ({ page_size }) => asText(await sonarr.history(page_size)),
  );
}
