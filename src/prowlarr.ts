import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServarrClient, asText } from "./base.js";

export class ProwlarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v1", appName: "Prowlarr" });
  }

  async listIndexers(): Promise<unknown> {
    return this.request("/indexer");
  }

  async indexerStats(): Promise<unknown> {
    return this.request("/indexerstats");
  }

  async search(
    query: string,
    indexerIds?: number[],
    categories?: number[],
  ): Promise<unknown> {
    const params: Record<string, string | number> = { query };
    if (indexerIds && indexerIds.length > 0) {
      params.indexerIds = indexerIds.join(",");
    }
    if (categories && categories.length > 0) {
      params.categories = categories.join(",");
    }
    return this.request("/search", params);
  }
}

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
}
