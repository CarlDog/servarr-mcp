import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerCommandTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_search_missing",
    {
      title: "Readarr: Search Missing Books",
      description:
        "Trigger Readarr to search indexers for all monitored, missing books. Async — returns the queued CommandResource (id, status); the actual search runs in the background. Poll Readarr's UI or query the queue tools to see results.",
      inputSchema: {},
    },
    async () => asText(await readarr.triggerCommand("MissingBookSearch")),
  );
}
