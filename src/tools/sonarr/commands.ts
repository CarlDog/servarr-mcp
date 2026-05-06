import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_COMMAND, ANN_READ, asText } from "../../clients/base.js";
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
      annotations: ANN_COMMAND,
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
        series_id: z
          .number()
          .int()
          .describe("The Sonarr series ID to refresh."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ series_id }) =>
      asText(
        await sonarr.triggerCommand("RefreshSeries", { seriesId: series_id }),
      ),
  );

  server.registerTool(
    "sonarr_search_series",
    {
      title: "Sonarr: Search Series",
      description:
        "Trigger Sonarr to search indexers for all monitored, missing episodes of one series. Async — returns the queued CommandResource.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ series_id }) =>
      asText(
        await sonarr.triggerCommand("SeriesSearch", { seriesId: series_id }),
      ),
  );

  server.registerTool(
    "sonarr_search_season",
    {
      title: "Sonarr: Search Season",
      description:
        "Trigger Sonarr to search indexers for one season of one series. Async — returns the queued CommandResource.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID."),
        season_number: z
          .number()
          .int()
          .min(0)
          .describe("Season number (0 for specials)."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ series_id, season_number }) =>
      asText(
        await sonarr.triggerCommand("SeasonSearch", {
          seriesId: series_id,
          seasonNumber: season_number,
        }),
      ),
  );

  server.registerTool(
    "sonarr_search_episode",
    {
      title: "Sonarr: Search Episodes",
      description:
        "Trigger Sonarr to search indexers for one or more specific episodes. Async — returns the queued CommandResource.",
      inputSchema: {
        episode_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Sonarr episode IDs to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ episode_ids }) =>
      asText(
        await sonarr.triggerCommand("EpisodeSearch", {
          episodeIds: episode_ids,
        }),
      ),
  );

  server.registerTool(
    "sonarr_get_command",
    {
      title: "Sonarr: Get Command Status",
      description:
        "Poll the status of an async command queued by sonarr_search_*, sonarr_refresh_series, etc. Returns the current CommandResource (status: queued|started|completed|failed, exception, started/ended timestamps).",
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
    async ({ id }) => asText(await sonarr.getCommand(id)),
  );
}
