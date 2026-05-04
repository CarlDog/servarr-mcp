import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

export function registerCommandTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_search_missing",
    {
      title: "Sonarr: Search Missing Episodes",
      description:
        "Trigger Sonarr to search indexers for all monitored, missing episodes. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Sonarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await sonarr.triggerCommand("MissingEpisodeSearch")),
  );

  server.registerTool(
    "sonarr_refresh_series",
    {
      title: "Sonarr: Refresh Series Metadata",
      description:
        "Trigger Sonarr to re-pull metadata from TVDB for one series (cast, episode list, artwork). Async — returns the queued CommandResource.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID to refresh."),
      },
    },
    async ({ series_id }) =>
      asText(
        await sonarr.triggerCommand("RefreshSeries", { seriesId: series_id }),
      ),
  );
}
