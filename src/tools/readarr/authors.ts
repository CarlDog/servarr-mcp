import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_ADD, ANN_EDIT, asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

// Readarr author-monitor options.
const AuthorMonitorOption = z.enum([
  "all",
  "future",
  "missing",
  "existing",
  "first",
  "latest",
  "none",
]);

export function registerAuthorTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_add_author",
    {
      title: "Readarr: Add Author",
      description:
        "Add a new author to Readarr by Goodreads ID. Internally calls /author/lookup to fetch the full AuthorResource, then POSTs /author with the merged body. Returns the created AuthorResource. " +
        "Workflow: call readarr_lookup_author first to get the foreignAuthorId, readarr_list_quality_profiles for quality_profile_id, readarr_list_metadata_profiles for metadata_profile_id, readarr_list_root_folders for root_folder_path. " +
        "Note: search_for_missing_books defaults to false here — Readarr's server-side default is true, which may immediately hit indexers; flip explicitly if you want that.",
      inputSchema: {
        foreign_author_id: z
          .string()
          .describe(
            "The Goodreads author id of the author to add (from readarr_lookup_author).",
          ),
        quality_profile_id: z
          .number()
          .int()
          .describe("Quality profile id (from readarr_list_quality_profiles)."),
        metadata_profile_id: z
          .number()
          .int()
          .describe(
            "Metadata profile id (from readarr_list_metadata_profiles).",
          ),
        root_folder_path: z
          .string()
          .describe("Root folder path (from readarr_list_root_folders)."),
        monitored: z
          .boolean()
          .optional()
          .describe("Track this author for missing books (default true)."),
        monitor: AuthorMonitorOption.optional().describe(
          "Which books to monitor on add (default 'all').",
        ),
        search_for_missing_books: z
          .boolean()
          .optional()
          .describe(
            "Trigger a search for missing books immediately on add (default false).",
          ),
      },
      annotations: ANN_ADD,
    },
    async ({
      foreign_author_id,
      quality_profile_id,
      metadata_profile_id,
      root_folder_path,
      monitored = true,
      monitor = "all",
      search_for_missing_books = false,
    }) => {
      const lookup = (await readarr.lookupAuthor(
        `readarr:${foreign_author_id}`,
      )) as Array<Record<string, unknown>>;
      if (!Array.isArray(lookup) || lookup.length === 0) {
        throw new Error(
          `Readarr lookup returned no results for foreignAuthorId ${foreign_author_id}.`,
        );
      }
      const author = lookup[0];
      const body = {
        ...author,
        qualityProfileId: quality_profile_id,
        metadataProfileId: metadata_profile_id,
        rootFolderPath: root_folder_path,
        monitored,
        addOptions: {
          monitor,
          searchForMissingBooks: search_for_missing_books,
        },
      };
      return asText(await readarr.addAuthor(body));
    },
  );

  server.registerTool(
    "readarr_edit_author",
    {
      title: "Readarr: Edit Author",
      description:
        "Edit settings on an existing Readarr author. Internally GETs the current AuthorResource, applies your changes, and PUTs the full resource back. Pass only the fields you want to change — others are preserved. WARNING: changing root_folder_path moves files on disk.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Readarr author id (from readarr_list_authors)."),
        monitored: z
          .boolean()
          .optional()
          .describe(
            "Toggle whether Readarr tracks this author for new releases.",
          ),
        quality_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the quality profile (from readarr_list_quality_profiles).",
          ),
        metadata_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the metadata profile (from readarr_list_metadata_profiles).",
          ),
        root_folder_path: z
          .string()
          .optional()
          .describe(
            "Change the root folder (from readarr_list_root_folders). WARNING: this moves the author's files on disk.",
          ),
        tags: z
          .array(z.number().int())
          .optional()
          .describe(
            "Replace the tag id list (from readarr_list_tags). Full replacement, not append.",
          ),
      },
      annotations: ANN_EDIT,
    },
    async ({
      id,
      monitored,
      quality_profile_id,
      metadata_profile_id,
      root_folder_path,
      tags,
    }) => {
      const current = (await readarr.getAuthor(id)) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };
      if (monitored !== undefined) updated.monitored = monitored;
      if (quality_profile_id !== undefined) {
        updated.qualityProfileId = quality_profile_id;
      }
      if (metadata_profile_id !== undefined) {
        updated.metadataProfileId = metadata_profile_id;
      }
      if (root_folder_path !== undefined) {
        updated.rootFolderPath = root_folder_path;
      }
      if (tags !== undefined) updated.tags = tags;
      return asText(await readarr.editAuthor(id, updated));
    },
  );
}
