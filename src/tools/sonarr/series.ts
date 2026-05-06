import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";

// Sonarr's MonitorType — values that make sense to expose. Omitting
// pilot/recent/monitorSpecials/unmonitorSpecials/unknown for v1.
const MonitorOption = z.enum([
  "all",
  "future",
  "missing",
  "existing",
  "firstSeason",
  "latestSeason",
  "none",
]);

export function registerSeriesTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_add_series",
    {
      title: "Sonarr: Add Series",
      description:
        "Add a new series to Sonarr by TVDB id. Internally calls /series/lookup to fetch the full series metadata, then POSTs /series with the merged body. Returns the created SeriesResource. " +
        "Workflow: call sonarr_lookup_series first to get the tvdbId, sonarr_list_quality_profiles for quality_profile_id, sonarr_list_root_folders for root_folder_path. " +
        "Note: search_for_missing_episodes defaults to false here — Sonarr's server-side default is true, which may immediately hit indexers; flip explicitly if you want that.",
      inputSchema: {
        tvdb_id: z
          .number()
          .int()
          .describe(
            "The TVDB id of the series to add (from sonarr_lookup_series).",
          ),
        quality_profile_id: z
          .number()
          .int()
          .describe("Quality profile id (from sonarr_list_quality_profiles)."),
        root_folder_path: z
          .string()
          .describe("Root folder path (from sonarr_list_root_folders)."),
        monitored: z
          .boolean()
          .optional()
          .describe("Track this series for missing episodes (default true)."),
        season_folder: z
          .boolean()
          .optional()
          .describe(
            "Organize episodes into per-season subfolders (default true).",
          ),
        monitor: MonitorOption.optional().describe(
          "Which episodes to monitor on add (default 'all').",
        ),
        search_for_missing_episodes: z
          .boolean()
          .optional()
          .describe(
            "Trigger a search for missing episodes immediately on add (default false).",
          ),
      },
    },
    async ({
      tvdb_id,
      quality_profile_id,
      root_folder_path,
      monitored = true,
      season_folder = true,
      monitor = "all",
      search_for_missing_episodes = false,
    }) => {
      const lookup = (await sonarr.lookupSeries(`tvdb:${tvdb_id}`)) as Array<
        Record<string, unknown>
      >;
      if (!Array.isArray(lookup) || lookup.length === 0) {
        throw new Error(
          `Sonarr lookup returned no results for TVDB id ${tvdb_id}.`,
        );
      }
      const series = lookup[0];
      const body = {
        ...series,
        qualityProfileId: quality_profile_id,
        rootFolderPath: root_folder_path,
        monitored,
        seasonFolder: season_folder,
        addOptions: {
          monitor,
          searchForMissingEpisodes: search_for_missing_episodes,
          searchForCutoffUnmetEpisodes: false,
        },
      };
      return asText(await sonarr.addSeries(body));
    },
  );

  server.registerTool(
    "sonarr_edit_series",
    {
      title: "Sonarr: Edit Series",
      description:
        "Edit settings on an existing Sonarr series. Internally GETs the current SeriesResource, applies your changes, and PUTs the full resource back. Pass only the fields you want to change — others are preserved. WARNING: changing root_folder_path moves files on disk; watch your storage and download client.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Sonarr series id (from sonarr_list_series)."),
        monitored: z
          .boolean()
          .optional()
          .describe(
            "Toggle whether Sonarr tracks this series for new episodes.",
          ),
        quality_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the quality profile (from sonarr_list_quality_profiles).",
          ),
        root_folder_path: z
          .string()
          .optional()
          .describe(
            "Change the root folder. WARNING: this moves the series files on disk.",
          ),
        season_folder: z
          .boolean()
          .optional()
          .describe("Toggle the per-season subfolder organization."),
        tags: z
          .array(z.number().int())
          .optional()
          .describe("Replace the tag id list (full list, not append)."),
      },
    },
    async ({
      id,
      monitored,
      quality_profile_id,
      root_folder_path,
      season_folder,
      tags,
    }) => {
      const current = (await sonarr.getSeries(id)) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };
      if (monitored !== undefined) updated.monitored = monitored;
      if (quality_profile_id !== undefined) {
        updated.qualityProfileId = quality_profile_id;
      }
      if (root_folder_path !== undefined) {
        updated.rootFolderPath = root_folder_path;
      }
      if (season_folder !== undefined) updated.seasonFolder = season_folder;
      if (tags !== undefined) updated.tags = tags;
      return asText(await sonarr.editSeries(id, updated));
    },
  );
}
