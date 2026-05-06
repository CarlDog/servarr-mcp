import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
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
    "sonarr_health",
    {
      title: "Sonarr: Health",
      description:
        "Get aggregated Sonarr health warnings (indexer down, low disk, etc.).",
      inputSchema: {},
    },
    async () => asText(await sonarr.health()),
  );

  server.registerTool(
    "sonarr_diskspace",
    {
      title: "Sonarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Sonarr.",
      inputSchema: {},
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
    },
    async () => asText(await sonarr.rootFolders()),
  );

  registerQueueTools(server, sonarr);
  registerHistoryTools(server, sonarr);
  registerWantedTools(server, sonarr);
  registerCommandTools(server, sonarr);
  registerSeriesTools(server, sonarr);
  registerReleaseTools(server, sonarr);
}
