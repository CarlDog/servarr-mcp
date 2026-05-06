import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

export function registerReleaseTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_release_search",
    {
      title: "Sonarr: Release Search",
      description:
        "Run a live indexer search for releases of a specific series, season, or episode and return candidate ReleaseResource entries (without grabbing). Hits every enabled indexer in real time — slow and rate-limit-sensitive, so call only when the user wants to pick a release manually. Pass `series_id` for the whole series, `season_number` to scope to a season, or `episode_id` to scope to a single episode. At least one is required. Returned items feed `sonarr_grab_release` (when it ships).",
      inputSchema: {
        series_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Sonarr series id (from sonarr_list_series). Required unless episode_id is set.",
          ),
        episode_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Sonarr episode id (from sonarr_list_episodes). Scopes to a single episode.",
          ),
        season_number: z
          .number()
          .int()
          .optional()
          .describe(
            "Season number, used with series_id to scope to a single season.",
          ),
      },
    },
    async ({ series_id, episode_id, season_number }) => {
      if (series_id === undefined && episode_id === undefined) {
        throw new Error(
          "sonarr_release_search requires series_id or episode_id — an unscoped /release call hits every indexer.",
        );
      }
      return asText(
        await sonarr.searchReleases({
          seriesId: series_id,
          episodeId: episode_id,
          seasonNumber: season_number,
        }),
      );
    },
  );
}
