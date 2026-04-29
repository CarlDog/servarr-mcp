import { ServarrClient } from "./base.js";

export class LidarrClient extends ServarrClient {
  constructor(url: string, apiKey: string) {
    super({ url, apiKey, apiPath: "/api/v1", appName: "Lidarr" });
  }

  async listArtists(): Promise<unknown> {
    return this.request("/artist");
  }

  async getArtist(id: number): Promise<unknown> {
    return this.request(`/artist/${id}`);
  }

  async lookupArtist(term: string): Promise<unknown> {
    return this.request("/artist/lookup", { term });
  }

  async listAlbums(artistId?: number): Promise<unknown> {
    if (artistId === undefined) {
      return this.request("/album");
    }
    return this.request("/album", { artistId });
  }
}
