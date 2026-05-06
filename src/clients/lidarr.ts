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

  async addArtist(body: unknown): Promise<unknown> {
    return this.requestPost("/artist", body);
  }

  async editArtist(id: number, body: unknown): Promise<unknown> {
    return this.requestPut(`/artist/${id}`, body);
  }

  async listAlbums(artistId?: number): Promise<unknown> {
    if (artistId === undefined) {
      return this.request("/album");
    }
    return this.request("/album", { artistId });
  }

  async getAlbum(id: number): Promise<unknown> {
    return this.request(`/album/${id}`);
  }

  async getTrack(id: number): Promise<unknown> {
    return this.request(`/track/${id}`);
  }

  async historyArtist(artistId: number): Promise<unknown> {
    return this.request("/history/artist", { artistId });
  }

  async listTrackfiles(opts: {
    artistId?: number;
    albumId?: number;
    unmapped?: boolean;
  }): Promise<unknown> {
    const params: Record<string, number | boolean> = {};
    if (opts.artistId !== undefined) params.artistId = opts.artistId;
    if (opts.albumId !== undefined) params.albumId = opts.albumId;
    if (opts.unmapped !== undefined) params.unmapped = opts.unmapped;
    return this.request("/trackfile", params);
  }
}
