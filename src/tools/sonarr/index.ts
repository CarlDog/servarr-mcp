import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, ANN_READ_EXT, asText } from "../../clients/base.js";
import type { SonarrClient } from "../../clients/sonarr.js";
import { registerCommandTools } from "./commands.js";
import { registerHistoryTools } from "./history.js";
import { registerQueueTools } from "./queue.js";
import { registerReleaseTools } from "./releases.js";
import { registerSeriesTools } from "./series.js";
import { registerWantedTools } from "./wanted.js";

export function registerSonarrTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_list_series",
    {
      title: "Sonarr: List Series",
      description:
        "List every TV series tracked by Sonarr (id, title, monitored state, season summary, file counts). Use to scan or filter the library; for one specific series use `sonarr_get_series`. To find a series NOT yet tracked, use `sonarr_lookup_series` (TVDB metadata).",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.listSeries()),
  );

  server.registerTool(
    "sonarr_get_series",
    {
      title: "Sonarr: Get Series",
      description:
        "Get full details for a Sonarr series by id — overview, cast, seasons, episode counts, file paths. Drill-down companion to `sonarr_list_series` and `sonarr_lookup_series`.",
      inputSchema: { id: z.number().int().describe("The Sonarr series ID") },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await sonarr.getSeries(id)),
  );

  server.registerTool(
    "sonarr_lookup_series",
    {
      title: "Sonarr: Lookup Series (TVDB)",
      description:
        "Fuzzy search TVDB for a series to potentially add. Returns SeriesResource with `tvdbId` etc., suitable for `sonarr_add_series`. Searches TVDB's catalogue, NOT your tracked library — use `sonarr_list_series` / `sonarr_get_series` for what's already tracked.",
      inputSchema: { term: z.string().describe("Search term") },
      annotations: ANN_READ_EXT,
    },
    async ({ term }) => asText(await sonarr.lookupSeries(term)),
  );

  server.registerTool(
    "sonarr_list_episodes",
    {
      title: "Sonarr: List Episodes",
      description:
        "List every episode for a Sonarr series. Returns episode ids you can drill into with `sonarr_get_episode` or pass to `sonarr_release_search` / `sonarr_search_episode`.",
      inputSchema: {
        series_id: z.number().int().describe("The Sonarr series ID"),
      },
      annotations: ANN_READ,
    },
    async ({ series_id }) => asText(await sonarr.listEpisodes(series_id)),
  );

  server.registerTool(
    "sonarr_get_episode",
    {
      title: "Sonarr: Get Episode",
      description:
        "Get full details for a single Sonarr episode by ID — air date, overview, file info, monitored state, etc.",
      inputSchema: {
        id: z.number().int().describe("The Sonarr episode ID"),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await sonarr.getEpisode(id)),
  );

  server.registerTool(
    "sonarr_calendar",
    {
      title: "Sonarr: Calendar",
      description:
        "Get upcoming/recent episodes from Sonarr's calendar within an ISO date window. Use for 'what's airing this week?' queries. Movies live in `radarr_calendar`; Lidarr/Readarr/Prowlarr have no calendar surface.",
      inputSchema: {
        start: z.string().optional().describe("ISO date — start of window"),
        end: z.string().optional().describe("ISO date — end of window"),
      },
      annotations: ANN_READ,
    },
    async ({ start, end }) => asText(await sonarr.calendar(start, end)),
  );

  server.registerTool(
    "sonarr_health",
    {
      title: "Sonarr: Health",
      description:
        "Get aggregated Sonarr health warnings (indexer down, low disk, etc.). Summary view; for actionable per-indexer failure detail (which indexers, since when, why) use `prowlarr_indexer_status`.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.health()),
  );

  server.registerTool(
    "sonarr_diskspace",
    {
      title: "Sonarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Sonarr. Useful for 'where do I have room to add this?' decisions; pair with `sonarr_list_root_folders` to map paths to capacity.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.diskspace()),
  );

  server.registerTool(
    "sonarr_list_quality_profiles",
    {
      title: "Sonarr: List Quality Profiles",
      description:
        "List Sonarr quality profiles. The `id` is required as `qualityProfileId` when adding a series.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.qualityProfiles()),
  );

  server.registerTool(
    "sonarr_list_root_folders",
    {
      title: "Sonarr: List Root Folders",
      description:
        "List Sonarr root folders (where series are stored on disk). The `path` is required as `rootFolderPath` when adding a series.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.rootFolders()),
  );

  server.registerTool(
    "sonarr_list_tags",
    {
      title: "Sonarr: List Tags",
      description:
        "List Sonarr tags (label + id pairs). Useful for scoping queries by tag (e.g. 'show me everything tagged kids') and for setting tag ids on add/edit operations.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await sonarr.tags()),
  );

  registerQueueTools(server, sonarr);
  registerHistoryTools(server, sonarr);
  registerWantedTools(server, sonarr);
  registerCommandTools(server, sonarr);
  registerSeriesTools(server, sonarr);
  registerReleaseTools(server, sonarr);
}
