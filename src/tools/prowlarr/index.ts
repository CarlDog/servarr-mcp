import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, ANN_READ_EXT, asText } from "../../clients/base.js";
import type { ProwlarrClient } from "../../clients/prowlarr.js";
import { projectRecordArray } from "../list-projection.js";

const SLIM_INDEXER_FIELDS = [
  "id",
  "name",
  "implementationName",
  "implementation",
  "protocol",
  "privacy",
  "enable",
  "supportsRss",
  "supportsSearch",
  "supportsRedirect",
  "supportsPagination",
  "priority",
  "appProfileId",
  "tags",
] as const;

export function registerProwlarrTools(
  server: McpServer,
  prowlarr: ProwlarrClient,
): void {
  server.registerTool(
    "prowlarr_list_indexers",
    {
      title: "Prowlarr: List Indexers",
      description: `List configured Prowlarr indexers using compact operational fields (${SLIM_INDEXER_FIELDS.join(", ")}). Opaque provider configuration fields are always omitted because they can contain credentials/passkeys and make routine output excessively large. Cross-reference with \`prowlarr_indexer_stats\` for query/grab counts and \`prowlarr_indexer_status\` for actionable failure detail.`,
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () =>
      asText(
        projectRecordArray(
          await prowlarr.listIndexers(),
          SLIM_INDEXER_FIELDS,
          "Indexer endpoint",
        ),
      ),
  );

  server.registerTool(
    "prowlarr_indexer_stats",
    {
      title: "Prowlarr: Indexer Stats",
      description:
        "Aggregate per-indexer counts: queries, grabs, average response time, failure rate. Useful for spotting slow or unreliable indexers. For per-indexer failure detail (which are currently disabled and why) use `prowlarr_indexer_status` — that's the actionable view.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await prowlarr.indexerStats()),
  );

  server.registerTool(
    "prowlarr_indexer_status",
    {
      title: "Prowlarr: Indexer Status",
      description:
        "Get the failure state for indexers Prowlarr currently considers unhealthy: which indexers are disabled-until-when and why (most recent failure message). Companion to `prowlarr_health`, which only summarizes — this returns the actionable per-indexer detail. Empty list means everything is healthy.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await prowlarr.indexerStatus()),
  );

  server.registerTool(
    "prowlarr_search",
    {
      title: "Prowlarr: Search Indexers",
      description:
        "Search across all configured indexers for releases matching a query. Hits indexers in real time — slow and rate-limit-sensitive. Heavier than the per-app `*_lookup_*` tools (which hit metadata, not indexers) and broader than `<app>_release_search` (which is scoped to one tracked entity). Use only when the user wants raw release results outside the *arr metadata flow.",
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
      annotations: ANN_READ_EXT,
    },
    async ({ query, indexer_ids, categories }) =>
      asText(await prowlarr.search(query, indexer_ids, categories)),
  );

  server.registerTool(
    "prowlarr_history",
    {
      title: "Prowlarr: History",
      description:
        "Recent Prowlarr history — queries fanned out to indexers, grab events, errors. Newest first. Use to debug 'what searches did Prowlarr run lately?'. Pairs with `prowlarr_indexer_status` for failure context.",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Records to return (default 20)"),
      },
      annotations: ANN_READ,
    },
    async ({ page_size }) => asText(await prowlarr.history(page_size)),
  );

  server.registerTool(
    "prowlarr_health",
    {
      title: "Prowlarr: Health",
      description:
        "Get aggregated Prowlarr health warnings (indexer down, proxy unreachable, etc.). Summary view; for actionable per-indexer failure detail use `prowlarr_indexer_status`.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await prowlarr.health()),
  );
}
