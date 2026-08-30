import { describe, expect, test } from "vitest";
import { RadarrClient } from "../clients/radarr.js";
import {
  buildManualImportFile,
  buildManualImportQuery,
  formatManualImportCandidates,
  registerRadarrManualImportTools,
  selectManualImportCandidate,
} from "./manual-import.js";
import { CaptureServer, fakeExtra } from "./_test_utils.js";

const quality = {
  quality: { id: 7, name: "Bluray-1080p" },
  revision: { version: 1 },
};

function candidate(path = "/downloads/movie.mkv") {
  return {
    id: 1,
    path,
    name: "movie.mkv",
    size: 1000,
    folderName: "download",
    quality,
    languages: [{ id: 1, name: "English" }],
    releaseGroup: "GROUP",
    downloadId: "abc",
    indexerFlags: 2,
    rejections: [{ reason: "Manual import required" }],
    movie: { id: 10, title: "Old Match", hasFile: true, movieFileId: 20 },
  };
}

describe("manual import discovery", () => {
  test("requires a folder or download id and uses safe defaults", () => {
    expect(() => buildManualImportQuery({})).toThrow(/folder or download_id/);
    expect(buildManualImportQuery({ downloadId: " abc " })).toEqual({
      downloadId: "abc",
      filterExistingFiles: true,
    });
    expect(
      buildManualImportQuery(
        { folder: "/downloads", replaceExistingFiles: true },
        true,
      ),
    ).toEqual({
      folder: "/downloads",
      filterExistingFiles: true,
      replaceExistingFiles: true,
    });
  });

  test("bounds and compacts candidate output", () => {
    const result = formatManualImportCandidates(
      "radarr",
      [candidate("/a"), candidate("/b")],
      { limit: 1 },
    );
    expect(result).toMatchObject({
      returned: 1,
      total: 2,
      truncated: true,
      mode: "compact",
    });
    const first = (result.candidates as Array<Record<string, unknown>>)[0]!;
    expect(first.movie).toMatchObject({
      id: 10,
      title: "Old Match",
      hasFile: true,
    });
    expect(first).not.toHaveProperty("folderName");
  });

  test("selects only one exact path and refuses stale or ambiguous choices", () => {
    expect(
      selectManualImportCandidate([candidate()], "/downloads/movie.mkv").id,
    ).toBe(1);
    expect(() =>
      selectManualImportCandidate([candidate()], "/wrong.mkv"),
    ).toThrow(/No current/);
    expect(() =>
      selectManualImportCandidate(
        [candidate(), candidate()],
        "/downloads/movie.mkv",
      ),
    ).toThrow(/Multiple current/);
  });
});

describe("manual import file payloads", () => {
  test("builds Radarr and Sonarr command files from trusted candidate fields plus explicit ids", () => {
    expect(
      buildManualImportFile(candidate(), { app: "radarr", movieId: 99 }),
    ).toMatchObject({
      path: "/downloads/movie.mkv",
      movieId: 99,
      quality,
      downloadId: "abc",
    });
    expect(
      buildManualImportFile(
        { ...candidate(), releaseType: "singleEpisode" },
        { app: "sonarr", seriesId: 12, episodeIds: [34] },
      ),
    ).toMatchObject({
      seriesId: 12,
      episodeIds: [34],
      releaseType: "singleEpisode",
    });
  });

  test("builds Lidarr and Readarr command files with explicit replacement-sensitive ids", () => {
    expect(
      buildManualImportFile(candidate(), {
        app: "lidarr",
        artistId: 1,
        albumId: 2,
        albumReleaseId: 3,
        trackIds: [4],
        disableReleaseSwitching: true,
      }),
    ).toMatchObject({
      artistId: 1,
      albumId: 2,
      albumReleaseId: 3,
      trackIds: [4],
      disableReleaseSwitching: true,
    });
    expect(
      buildManualImportFile(candidate(), {
        app: "readarr",
        authorId: 5,
        bookId: 6,
        foreignEditionId: "edition-7",
        disableReleaseSwitching: false,
      }),
    ).toMatchObject({
      authorId: 5,
      bookId: 6,
      foreignEditionId: "edition-7",
      disableReleaseSwitching: false,
    });
  });
});

describe("radarr_manual_import", () => {
  test("re-fetches the exact candidate and queues the real ManualImport command", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    radarr.manualImportCandidates = async () => [candidate()];
    radarr.triggerCommand = async (name, args = {}) => {
      calls.push({ name, args });
      return { id: 123, status: "queued" };
    };
    const server = new CaptureServer();
    registerRadarrManualImportTools(server as never, radarr);
    await server.byName("radarr_manual_import").callback(
      {
        download_id: "abc",
        path: "/downloads/movie.mkv",
        movie_id: 99,
        import_mode: "move",
        confirm: true,
      },
      fakeExtra(),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "ManualImport",
      args: {
        importMode: "move",
        files: [{ path: "/downloads/movie.mkv", movieId: 99 }],
      },
    });
  });
});
