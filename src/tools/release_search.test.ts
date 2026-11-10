// The "at least one id required" handler-level guard on the
// release_search tools (Sonarr / Lidarr / Readarr). Radarr's tool
// has a single required movie_id at the schema layer, so no guard
// to test there.

import { describe, expect, test, vi } from "vitest";
import { LidarrClient } from "../clients/lidarr.js";
import { ReadarrClient } from "../clients/readarr.js";
import { SonarrClient } from "../clients/sonarr.js";
import { registerLidarrTools } from "./lidarr/index.js";
import { registerReadarrTools } from "./readarr/index.js";
import { registerSonarrTools } from "./sonarr/index.js";
import { CaptureServer, fakeExtra } from "./_test_utils.js";

describe("release_search unscoped guard", () => {
  test("sonarr_release_search refuses calls with no series_id and no episode_id", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_release_search");

    await expect(tool.callback({}, fakeExtra())).rejects.toThrow(
      /requires series_id or episode_id/,
    );
  });

  test.each([{}, { series_id: 12 }, { season_number: 0 }])(
    "sonarr_release_search refuses incomplete scope %j before contacting Sonarr",
    async (scope) => {
      const sonarr = new SonarrClient("http://x", "k");
      const search = vi.spyOn(sonarr, "searchReleases").mockResolvedValue([]);
      const server = new CaptureServer();
      registerSonarrTools(server as never, sonarr);

      await expect(
        server.byName("sonarr_release_search").callback(scope, fakeExtra()),
      ).rejects.toThrow(/requires/);
      expect(search).not.toHaveBeenCalled();
    },
  );

  test.each([
    [
      { series_id: 12, season_number: 0 },
      { seriesId: 12, seasonNumber: 0 },
    ],
    [
      { series_id: 12, season_number: 2 },
      { seriesId: 12, seasonNumber: 2 },
    ],
    [{ episode_id: 123 }, { episodeId: 123 }],
    [
      { series_id: 12, episode_id: 123 },
      { seriesId: 12, episodeId: 123 },
    ],
  ])(
    "sonarr_release_search accepts scoped input %j",
    async (scope, expected) => {
      const sonarr = new SonarrClient("http://x", "k");
      const search = vi.spyOn(sonarr, "searchReleases").mockResolvedValue([]);
      const server = new CaptureServer();
      registerSonarrTools(server as never, sonarr);

      await server.byName("sonarr_release_search").callback(scope, fakeExtra());
      expect(search).toHaveBeenCalledExactlyOnceWith({
        seriesId: undefined,
        seasonNumber: undefined,
        episodeId: undefined,
        ...expected,
      });
    },
  );

  test("lidarr_release_search refuses calls with no artist_id and no album_id", async () => {
    const lidarr = new LidarrClient("http://x", "k");
    const server = new CaptureServer();
    registerLidarrTools(server as never, lidarr);
    const tool = server.byName("lidarr_release_search");

    await expect(tool.callback({}, fakeExtra())).rejects.toThrow(
      /requires artist_id or album_id/,
    );
  });

  test("readarr_release_search refuses calls with no author_id and no book_id", async () => {
    const readarr = new ReadarrClient("http://x", "k");
    const server = new CaptureServer();
    registerReadarrTools(server as never, readarr);
    const tool = server.byName("readarr_release_search");

    await expect(tool.callback({}, fakeExtra())).rejects.toThrow(
      /requires author_id or book_id/,
    );
  });

  test("guard does not fire when at least one id is provided", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    // Stub the underlying call so we don't hit a real Sonarr.
    sonarr.searchReleases = async () => [];
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_release_search");

    await expect(
      tool.callback({ episode_id: 123 }, fakeExtra()),
    ).resolves.toBeDefined();
  });
});
