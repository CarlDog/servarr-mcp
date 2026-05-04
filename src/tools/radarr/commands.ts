import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerCommandTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_search_missing",
    {
      title: "Radarr: Search Missing Movies",
      description:
        "Trigger Radarr to search indexers for all monitored, missing movies. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Radarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await radarr.triggerCommand("MissingMoviesSearch")),
  );
}
