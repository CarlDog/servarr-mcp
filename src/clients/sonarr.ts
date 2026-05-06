import { ServarrClient } from "./base.js";

export class SonarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v3", appName: "Sonarr" });
  }

  async listSeries(): Promise<unknown> {
    return this.request("/series");
  }

  async getSeries(id: number): Promise<unknown> {
    return this.request(`/series/${id}`);
  }

  async lookupSeries(term: string): Promise<unknown> {
    return this.request("/series/lookup", { term });
  }

  async addSeries(body: unknown): Promise<unknown> {
    return this.requestPost("/series", body);
  }

  async editSeries(id: number, body: unknown): Promise<unknown> {
    return this.requestPut(`/series/${id}`, body);
  }

  async listEpisodes(seriesId: number): Promise<unknown> {
    return this.request("/episode", { seriesId });
  }

  async getEpisode(id: number): Promise<unknown> {
    return this.request(`/episode/${id}`);
  }

  async historySeries(seriesId: number): Promise<unknown> {
    return this.request("/history/series", { seriesId });
  }

  async calendar(start?: string, end?: string): Promise<unknown> {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return this.request("/calendar", params);
  }
}
