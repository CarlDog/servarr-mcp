import { ServarrClient } from "./base.js";

export class RadarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v3", appName: "Radarr" });
  }

  async listMovies(): Promise<unknown> {
    return this.request("/movie");
  }

  async getMovie(id: number): Promise<unknown> {
    return this.request(`/movie/${id}`);
  }

  async lookupMovie(term: string): Promise<unknown> {
    return this.request("/movie/lookup", { term });
  }

  async calendar(start?: string, end?: string): Promise<unknown> {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return this.request("/calendar", params);
  }
}
