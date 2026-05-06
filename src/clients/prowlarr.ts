import { ServarrClient } from "./base.js";

export class ProwlarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v1", appName: "Prowlarr" });
  }

  async listIndexers(): Promise<unknown> {
    return this.request("/indexer");
  }

  async indexerStats(): Promise<unknown> {
    return this.request("/indexerstats");
  }

  async indexerStatus(): Promise<unknown> {
    return this.request("/indexerstatus");
  }

  async search(
    query: string,
    indexerIds?: number[],
    categories?: number[],
  ): Promise<unknown> {
    const params: Record<string, string | number> = { query };
    if (indexerIds && indexerIds.length > 0) {
      params.indexerIds = indexerIds.join(",");
    }
    if (categories && categories.length > 0) {
      params.categories = categories.join(",");
    }
    return this.request("/search", params);
  }
}
