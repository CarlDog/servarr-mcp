// Verify the mapped*Id → *Id fix-up logic in grab_release handlers.
// This is exactly the bug we caught smoke-testing Princess Mononoke
// (Radarr) and Daredevil S02E08 (Sonarr): GET /release returns the
// destination ids null with the parsed match in mapped* fields, and
// POST /release fails without the direct ids set.

import { describe, expect, test } from "vitest";
import { LidarrClient } from "../clients/lidarr.js";
import { RadarrClient } from "../clients/radarr.js";
import { SonarrClient } from "../clients/sonarr.js";
import { registerLidarrTools } from "./lidarr/index.js";
import { registerRadarrTools } from "./radarr/index.js";
import { registerSonarrTools } from "./sonarr/index.js";
import { CaptureServer, fakeExtra } from "./_test_utils.js";

function captureGrabBody<
  T extends { grabRelease: (b: Record<string, unknown>) => Promise<unknown> },
>(
  client: T,
): { client: T; lastBody: { value: Record<string, unknown> | null } } {
  const lastBody = { value: null as Record<string, unknown> | null };
  client.grabRelease = async (body) => {
    lastBody.value = body;
    return { ok: true };
  };
  return { client, lastBody };
}

describe("radarr_grab_release", () => {
  test("copies mappedMovieId → movieId before posting", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(radarr);
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_grab_release");

    // Real Radarr GET /release omits movieId entirely (not even
    // `movieId: null`) when there's no direct match; the parser-mapped
    // id lives in mappedMovieId. The handler must spot the missing
    // field and copy across.
    await tool.callback(
      {
        release: {
          guid: "g",
          indexerId: 1,
          mappedMovieId: 7899,
        },
      },
      fakeExtra(),
    );

    expect(lastBody.value?.movieId).toBe(7899);
    expect(lastBody.value?.mappedMovieId).toBe(7899); // passthrough preserved
  });

  test("does not overwrite caller-provided movieId", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(radarr);
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_grab_release");

    await tool.callback(
      {
        release: {
          guid: "g",
          indexerId: 1,
          movieId: 9999, // explicit override
          mappedMovieId: 7899,
        },
      },
      fakeExtra(),
    );

    expect(lastBody.value?.movieId).toBe(9999);
  });

  test("sets shouldOverride when should_override=true", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(radarr);
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_grab_release");

    await tool.callback(
      {
        release: { guid: "g", indexerId: 1, mappedMovieId: 1 },
        should_override: true,
      },
      fakeExtra(),
    );

    expect(lastBody.value?.shouldOverride).toBe(true);
  });
});

describe("sonarr_grab_release", () => {
  test("copies mappedSeriesId → seriesId and mappedEpisodeInfo[].id → episodeIds", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(sonarr);
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_grab_release");

    // Real Sonarr GET /release omits seriesId / episodeIds entirely
    // when not directly matched; the parser puts the mapping in
    // mappedSeriesId and mappedEpisodeInfo[].id.
    await tool.callback(
      {
        release: {
          guid: "g",
          indexerId: 1,
          mappedSeriesId: 1276,
          mappedEpisodeInfo: [
            { id: 154373, seasonNumber: 2, episodeNumber: 8 },
          ],
        },
      },
      fakeExtra(),
    );

    expect(lastBody.value?.seriesId).toBe(1276);
    expect(lastBody.value?.episodeIds).toEqual([154373]);
  });

  test("does not overwrite caller-provided seriesId/episodeIds", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(sonarr);
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_grab_release");

    await tool.callback(
      {
        release: {
          guid: "g",
          indexerId: 1,
          seriesId: 999,
          episodeIds: [42],
          mappedSeriesId: 1276,
          mappedEpisodeInfo: [{ id: 154373 }],
        },
      },
      fakeExtra(),
    );

    expect(lastBody.value?.seriesId).toBe(999);
    expect(lastBody.value?.episodeIds).toEqual([42]);
  });
});

describe("lidarr_grab_release", () => {
  test("passes the release through verbatim (no mapped fields exist)", async () => {
    const lidarr = new LidarrClient("http://x", "k");
    const { lastBody } = captureGrabBody(lidarr);
    const server = new CaptureServer();
    registerLidarrTools(server as never, lidarr);
    const tool = server.byName("lidarr_grab_release");

    const release = { guid: "g", indexerId: 1, artistId: 5, albumId: 10 };
    await tool.callback({ release }, fakeExtra());

    expect(lastBody.value).toMatchObject({
      guid: "g",
      indexerId: 1,
      artistId: 5,
      albumId: 10,
    });
  });
});
