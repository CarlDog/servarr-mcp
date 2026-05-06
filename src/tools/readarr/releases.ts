import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText, withProgress } from "../../clients/base.js";
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
    async ({ author_id, book_id }, extra) => {
      if (author_id === undefined && book_id === undefined) {
        throw new Error(
          "readarr_release_search requires author_id or book_id — an unscoped /release call hits every indexer.",
        );
      }
      const scope =
        book_id !== undefined ? `book ${book_id}` : `author ${author_id}`;
      return withProgress(
        extra,
        (s) => `Readarr: searching indexers for ${scope}… (${s}s elapsed)`,
        20000,
        async () =>
          asText(
            await readarr.searchReleases({
              authorId: author_id,
              bookId: book_id,
            }),
          ),
      );
    },
  );

  server.registerTool(
    "readarr_grab_release",
    {
      title: "Readarr: Grab Release",
      description:
        "HIGH RISK. Immediately queues a download from the indexer for the given release. Pass the `release` object verbatim from `readarr_release_search` output — Readarr looks the release up server-side by guid+indexerId, so the cache must still be warm (re-run release_search if the grab fails with a 'not found' error). If the release was rejected by the quality profile, set `should_override` to true to grab anyway.",
      inputSchema: {
        release: z
          .object({
            guid: z.string(),
            indexerId: z.number().int(),
          })
          .passthrough()
          .describe(
            "The ReleaseResource object returned by readarr_release_search. Pass it verbatim — guid + indexerId are what Readarr keys on; other fields ride along.",
          ),
        should_override: z
          .boolean()
          .optional()
          .describe(
            "Force-grab a release even if the quality profile rejected it (default false). Mirrors Readarr's UI 'Override and Download' button.",
          ),
      },
    },
    async ({ release, should_override = false }) => {
      const body: Record<string, unknown> = { ...release };
      if (should_override) body.shouldOverride = true;
      return asText(await readarr.grabRelease(body));
    },
  );
}
