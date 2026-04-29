import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServarrClient, asText } from "./base.js";

export class ReadarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v1", appName: "Readarr" });
  }

  async listAuthors(): Promise<unknown> {
    return this.request("/author");
  }

  async getAuthor(id: number): Promise<unknown> {
    return this.request(`/author/${id}`);
  }

  async lookupAuthor(term: string): Promise<unknown> {
    return this.request("/author/lookup", { term });
  }

  async listBooks(authorId?: number): Promise<unknown> {
    if (authorId === undefined) {
      return this.request("/book");
    }
    return this.request("/book", { authorId });
  }
}

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
}
