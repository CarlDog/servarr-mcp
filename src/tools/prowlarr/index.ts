import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ProwlarrClient } from "../../clients/prowlarr.js";

export function registerProwlarrTools(
  server: McpServer,
  prowlarr: ProwlarrClient,
): void {
  server.registerTool(
    "prowlarr_list_indexers",
    {
      title: "Prowlarr: List Indexers",
      description: "List all configured indexers in Prowlarr.",
      inputSchema: {},
    },
    async () => asText(await prowlarr.listIndexers()),
  );

  server.registerTool(
    "prowlarr_indexer_stats",
    {
      title: "Prowlarr: Indexer Stats",
      description: "Get per-indexer query and grab statistics.",
      inputSchema: {},
    },
    async () => asText(await prowlarr.indexerStats()),
  );

  server.registerTool(
    "prowlarr_search",
    {
      title: "Prowlarr: Search Indexers",
      description: "Search across configured indexers for releases.",
      inputSchema: {
        query: z.string().describe("Search query"),
        indexer_ids: z
          .array(z.number().int())
          .optional()
          .describe("Optional list of indexer IDs to limit the search"),
        categories: z
          .array(z.number().int())
          .optional()
          .describe("Optional list of category IDs to limit the search"),
      },
    },
    async ({ query, indexer_ids, categories }) =>
      asText(await prowlarr.search(query, indexer_ids, categories)),
  );

  server.registerTool(
    "prowlarr_history",
    {
      title: "Prowlarr: History",
      description: "Get recent Prowlarr history (queries, grabs, etc.).",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
      },
    },
    async ({ page_size }) => asText(await prowlarr.history(page_size)),
  );

  server.registerTool(
    "prowlarr_health",
    {
      title: "Prowlarr: Health",
      description:
        "Get aggregated Prowlarr health warnings (indexer down, proxy unreachable, etc.).",
      inputSchema: {},
    },
    async () => asText(await prowlarr.health()),
  );
}
