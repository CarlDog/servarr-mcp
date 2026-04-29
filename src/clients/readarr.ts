import { ServarrClient } from "./base.js";

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
