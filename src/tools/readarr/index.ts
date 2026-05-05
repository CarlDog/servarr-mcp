import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";
import { registerCommandTools } from "./commands.js";
import { registerWantedTools } from "./wanted.js";

export function registerReadarrTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_list_authors",
    {
      title: "Readarr: List Authors",
      description: "List all authors tracked by Readarr.",
      inputSchema: {},
    },
    async () => asText(await readarr.listAuthors()),
  );

  server.registerTool(
    "readarr_get_author",
    {
      title: "Readarr: Get Author",
      description: "Get details for a specific Readarr author by ID.",
      inputSchema: { id: z.number().int().describe("The Readarr author ID") },
    },
    async ({ id }) => asText(await readarr.getAuthor(id)),
  );

  server.registerTool(
    "readarr_lookup_author",
    {
      title: "Readarr: Lookup Author",
      description: "Search for a new author to add to Readarr.",
      inputSchema: { term: z.string().describe("Search term") },
    },
    async ({ term }) => asText(await readarr.lookupAuthor(term)),
  );

  server.registerTool(
    "readarr_list_books",
    {
      title: "Readarr: List Books",
      description:
        "List books tracked by Readarr, optionally filtered to a single author.",
      inputSchema: {
        author_id: z
          .number()
          .int()
          .optional()
          .describe("Optional author ID filter"),
      },
    },
    async ({ author_id }) => asText(await readarr.listBooks(author_id)),
  );

  server.registerTool(
    "readarr_queue",
    {
      title: "Readarr: Queue",
      description: "Get the current Readarr download queue.",
      inputSchema: {},
    },
    async () => asText(await readarr.queue()),
  );

  server.registerTool(
    "readarr_history",
    {
      title: "Readarr: History",
      description: "Get recent Readarr history (newest first).",
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
    async ({ page_size }) => asText(await readarr.history(page_size)),
  );

  server.registerTool(
    "readarr_health",
    {
      title: "Readarr: Health",
      description:
        "Get aggregated Readarr health warnings (indexer down, low disk, etc.).",
      inputSchema: {},
    },
    async () => asText(await readarr.health()),
  );

  server.registerTool(
    "readarr_diskspace",
    {
      title: "Readarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Readarr.",
      inputSchema: {},
    },
    async () => asText(await readarr.diskspace()),
  );

  server.registerTool(
    "readarr_list_quality_profiles",
    {
      title: "Readarr: List Quality Profiles",
      description:
        "List Readarr quality profiles. The `id` is required as `qualityProfileId` when adding an author.",
      inputSchema: {},
    },
    async () => asText(await readarr.qualityProfiles()),
  );

  server.registerTool(
    "readarr_list_metadata_profiles",
    {
      title: "Readarr: List Metadata Profiles",
      description:
        "List Readarr metadata profiles (controls which editions/books from an author qualify — minPopularity, skipMissingDate, skipMissingIsbn, allowedLanguages, minPages, etc.). The `id` is required as `metadataProfileId` when adding an author.",
      inputSchema: {},
    },
    async () => asText(await readarr.metadataProfiles()),
  );

  server.registerTool(
    "readarr_list_root_folders",
    {
      title: "Readarr: List Root Folders",
      description:
        "List Readarr root folders (where books are stored on disk). The `path` is required as `rootFolderPath` when adding an author.",
      inputSchema: {},
    },
    async () => asText(await readarr.rootFolders()),
  );

  registerWantedTools(server, readarr);
  registerCommandTools(server, readarr);
}
