import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, ANN_READ_EXT, asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";
import { registerAuthorTools } from "./authors.js";
import { registerCommandTools } from "./commands.js";
import { registerHistoryTools } from "./history.js";
import { registerQueueTools } from "./queue.js";
import { registerReleaseTools } from "./releases.js";
import { registerWantedTools } from "./wanted.js";

export function registerReadarrTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_list_authors",
    {
      title: "Readarr: List Authors",
      description:
        "List every author tracked by Readarr (id, name, monitored state, book counts). Use to scan or filter the library; for one specific author use `readarr_get_author`. To find an author NOT yet tracked, use `readarr_lookup_author` (Goodreads metadata).",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await readarr.listAuthors()),
  );

  server.registerTool(
    "readarr_get_author",
    {
      title: "Readarr: Get Author",
      description:
        "Get full details for a Readarr author by id — overview, monitored state, statistics, books. Drill-down companion to `readarr_list_authors` and `readarr_lookup_author`.",
      inputSchema: { id: z.number().int().describe("The Readarr author ID") },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await readarr.getAuthor(id)),
  );

  server.registerTool(
    "readarr_lookup_author",
    {
      title: "Readarr: Lookup Author (Goodreads)",
      description:
        "Fuzzy search Goodreads for an author to potentially add. Returns AuthorResource with `foreignAuthorId` etc., suitable for `readarr_add_author`. Searches Goodreads's catalogue, NOT your tracked library — use `readarr_list_authors` / `readarr_get_author` for what's already tracked. Note: Goodreads metadata source has known reliability issues; expect occasional lookup failures.",
      inputSchema: { term: z.string().describe("Search term") },
      annotations: ANN_READ_EXT,
    },
    async ({ term }) => asText(await readarr.lookupAuthor(term)),
  );

  server.registerTool(
    "readarr_list_books",
    {
      title: "Readarr: List Books",
      description:
        "List books tracked by Readarr, optionally filtered to a single author. Returns book ids you can drill into with `readarr_get_book` or pass to `readarr_release_search`.",
      inputSchema: {
        author_id: z
          .number()
          .int()
          .optional()
          .describe("Optional author ID filter"),
      },
      annotations: ANN_READ,
    },
    async ({ author_id }) => asText(await readarr.listBooks(author_id)),
  );

  server.registerTool(
    "readarr_get_book",
    {
      title: "Readarr: Get Book",
      description:
        "Get full details for a single Readarr book by ID — release date, edition info, file info, monitored state, etc.",
      inputSchema: {
        id: z.number().int().describe("The Readarr book ID"),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await readarr.getBook(id)),
  );

  server.registerTool(
    "readarr_health",
    {
      title: "Readarr: Health",
      description:
        "Get aggregated Readarr health warnings (indexer down, low disk, etc.). Summary view; for actionable per-indexer failure detail use `prowlarr_indexer_status`.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await readarr.health()),
  );

  server.registerTool(
    "readarr_diskspace",
    {
      title: "Readarr: Disk Space",
      description:
        "Get per-mount disk space (free/total bytes) seen by Readarr. Useful for 'where do I have room to add this?' decisions; pair with `readarr_list_root_folders` to map paths to capacity.",
      inputSchema: {},
      annotations: ANN_READ,
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
      annotations: ANN_READ,
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
      annotations: ANN_READ,
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
      annotations: ANN_READ,
    },
    async () => asText(await readarr.rootFolders()),
  );

  server.registerTool(
    "readarr_list_tags",
    {
      title: "Readarr: List Tags",
      description:
        "List Readarr tags (label + id pairs). Useful for scoping queries by tag and for setting tag ids on add/edit operations.",
      inputSchema: {},
      annotations: ANN_READ,
    },
    async () => asText(await readarr.tags()),
  );

  registerQueueTools(server, readarr);
  registerHistoryTools(server, readarr);
  registerWantedTools(server, readarr);
  registerCommandTools(server, readarr);
  registerAuthorTools(server, readarr);
  registerReleaseTools(server, readarr);
}
