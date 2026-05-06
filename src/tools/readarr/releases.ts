import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { ReadarrClient } from "../../clients/readarr.js";

export function registerReleaseTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_release_search",
    {
      title: "Readarr: Release Search",
      description:
        "Run a live indexer search for releases of a specific author or book and return candidate ReleaseResource entries (without grabbing). Hits every enabled indexer in real time — slow and rate-limit-sensitive, so call only when the user wants to pick a release manually. At least one of `author_id` or `book_id` is required. Returned items feed `readarr_grab_release` (when it ships).",
      inputSchema: {
        author_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Readarr author id (from readarr_list_authors). Scopes the search to that author's bibliography.",
          ),
        book_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Readarr book id (from readarr_list_books). Scopes to a single book.",
          ),
      },
    },
    async ({ author_id, book_id }) => {
      if (author_id === undefined && book_id === undefined) {
        throw new Error(
          "readarr_release_search requires author_id or book_id — an unscoped /release call hits every indexer.",
        );
      }
      return asText(
        await readarr.searchReleases({
          authorId: author_id,
          bookId: book_id,
        }),
      );
    },
  );
}
