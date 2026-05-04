import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
}
