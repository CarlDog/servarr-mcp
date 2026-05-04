import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asText } from "../../clients/base.js";
import type { LidarrClient } from "../../clients/lidarr.js";

export function registerCommandTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_search_missing",
    {
      title: "Lidarr: Search Missing Albums",
      description:
        "Trigger Lidarr to search indexers for all monitored, missing albums. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Lidarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await lidarr.triggerCommand("MissingAlbumSearch")),
  );
}
