import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_COMMAND, ANN_READ, asText } from "../../clients/base.js";
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
      annotations: ANN_COMMAND,
    },
    async () => asText(await readarr.triggerCommand("MissingBookSearch")),
  );

  server.registerTool(
    "readarr_refresh_author",
    {
      title: "Readarr: Refresh Author Metadata",
      description:
        "Trigger Readarr to re-pull metadata for one author (bibliography, artwork). Async — returns the queued CommandResource.",
      inputSchema: {
        author_id: z
          .number()
          .int()
          .describe("The Readarr author ID to refresh."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ author_id }) =>
      asText(
        await readarr.triggerCommand("RefreshAuthor", { authorId: author_id }),
      ),
  );

  server.registerTool(
    "readarr_search_author",
    {
      title: "Readarr: Search Author",
      description:
        "Trigger Readarr to search indexers for all monitored, missing books of one author. Async — returns the queued CommandResource.",
      inputSchema: {
        author_id: z
          .number()
          .int()
          .describe("The Readarr author ID to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ author_id }) =>
      asText(
        await readarr.triggerCommand("AuthorSearch", { authorId: author_id }),
      ),
  );

  server.registerTool(
    "readarr_search_book",
    {
      title: "Readarr: Search Books",
      description:
        "Trigger Readarr to search indexers for one or more specific books. Async — returns the queued CommandResource.",
      inputSchema: {
        book_ids: z
          .array(z.number().int())
          .min(1)
          .describe("One or more Readarr book IDs to search."),
      },
      annotations: ANN_COMMAND,
    },
    async ({ book_ids }) =>
      asText(await readarr.triggerCommand("BookSearch", { bookIds: book_ids })),
  );

  server.registerTool(
    "readarr_get_command",
    {
      title: "Readarr: Get Command Status",
      description:
        "Poll the status of an async command queued by readarr_search_*, readarr_refresh_author, etc. Returns the current CommandResource (status: queued|started|completed|failed, exception, started/ended timestamps).",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe(
            "The command id returned by the trigger tool (CommandResource.id).",
          ),
      },
      annotations: ANN_READ,
    },
    async ({ id }) => asText(await readarr.getCommand(id)),
  );
}
