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

  async addAuthor(body: unknown): Promise<unknown> {
    return this.requestPost("/author", body);
  }

  async editAuthor(
    id: number,
    body: unknown,
    moveFiles = false,
  ): Promise<unknown> {
    return this.requestPut(`/author/${id}`, body, { moveFiles });
  }

  async listBooks(authorId?: number): Promise<unknown> {
    if (authorId === undefined) {
      return this.request("/book");
    }
    return this.request("/book", { authorId });
  }

  async getBook(id: number): Promise<unknown> {
    return this.request(`/book/${id}`);
  }

  async historyAuthor(authorId: number): Promise<unknown> {
    return this.request("/history/author", { authorId });
  }
}
