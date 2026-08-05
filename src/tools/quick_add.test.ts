// Verify radarr_quick_add_movie / sonarr_quick_add_series: the
// lookup-then-add collapse, and the "refuse and list options" fallback
// for ambiguous title matches, quality profiles, and root folders (never
// silently guess among multiple real candidates).

import { describe, expect, test } from "vitest";
import { RadarrClient } from "../clients/radarr.js";
import { SonarrClient } from "../clients/sonarr.js";
import { registerRadarrTools } from "./radarr/index.js";
import { registerSonarrTools } from "./sonarr/index.js";
import { CaptureServer, fakeExtra } from "./_test_utils.js";

const oneProfile = [{ id: 4, name: "HD-1080p" }];
const twoProfiles = [
  { id: 4, name: "HD-1080p" },
  { id: 5, name: "Ultra-HD" },
];
const oneFolder = [{ id: 1, path: "/movies" }];
const twoFolders = [
  { id: 1, path: "/movies" },
  { id: 2, path: "/movies-4k" },
];

describe("radarr_quick_add_movie", () => {
  function setUp() {
    const radarr = new RadarrClient("http://x", "k");
    const lastBody = { value: null as Record<string, unknown> | null };
    let addCalled = false;
    let profilesCalled = 0;
    let foldersCalled = 0;
    radarr.addMovie = async (body) => {
      addCalled = true;
      lastBody.value = body as Record<string, unknown>;
      return { id: 99 };
    };
    radarr.qualityProfiles = async () => {
      profilesCalled += 1;
      return oneProfile;
    };
    radarr.rootFolders = async () => {
      foldersCalled += 1;
      return oneFolder;
    };
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_quick_add_movie");
    return {
      radarr,
      tool,
      lastBody,
      addCalled: () => addCalled,
      profilesCalled: () => profilesCalled,
      foldersCalled: () => foldersCalled,
    };
  }

  test("adds on a single unambiguous match, auto-picking the only profile/folder", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];

    await ctx.tool.callback({ term: "Dune 2021" }, fakeExtra());

    expect(ctx.addCalled()).toBe(true);
    expect(ctx.lastBody.value).toMatchObject({
      title: "Dune",
      tmdbId: 438631,
      qualityProfileId: 4,
      rootFolderPath: "/movies",
      monitored: true,
      addOptions: { searchForMovie: false },
    });
    expect(ctx.profilesCalled()).toBe(1);
    expect(ctx.foldersCalled()).toBe(1);
  });

  test("refuses and lists candidates on an ambiguous title match, without adding", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 1984, tmdbId: 841 },
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];

    await expect(
      ctx.tool.callback({ term: "Dune" }, fakeExtra()),
    ).rejects.toThrow(/matched 2 movies.*Dune \(1984\).*tmdb_id=841/s);
    expect(ctx.addCalled()).toBe(false);
  });

  test("throws with no results and does not add", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [];

    await expect(
      ctx.tool.callback({ term: "not a real movie" }, fakeExtra()),
    ).rejects.toThrow(/no results/);
    expect(ctx.addCalled()).toBe(false);
  });

  test("refuses and lists profiles when more than one is configured and none specified", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];
    ctx.radarr.qualityProfiles = async () => twoProfiles;

    await expect(
      ctx.tool.callback({ term: "Dune 2021" }, fakeExtra()),
    ).rejects.toThrow(/quality_profile_id is required.*id=4.*id=5/s);
    expect(ctx.addCalled()).toBe(false);
  });

  test("refuses when zero quality profiles are configured", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];
    ctx.radarr.qualityProfiles = async () => [];

    await expect(
      ctx.tool.callback({ term: "Dune 2021" }, fakeExtra()),
    ).rejects.toThrow(/No quality profiles are configured/);
    expect(ctx.addCalled()).toBe(false);
  });

  test("refuses and lists root folders when more than one is configured and none specified", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];
    ctx.radarr.rootFolders = async () => twoFolders;

    await expect(
      ctx.tool.callback({ term: "Dune 2021" }, fakeExtra()),
    ).rejects.toThrow(/root_folder_path is required.*\/movies.*\/movies-4k/s);
    expect(ctx.addCalled()).toBe(false);
  });

  test("skips both live lookups when quality_profile_id and root_folder_path are both given explicitly", async () => {
    const ctx = setUp();
    ctx.radarr.lookupMovie = async () => [
      { title: "Dune", year: 2021, tmdbId: 438631 },
    ];

    await ctx.tool.callback(
      {
        term: "Dune 2021",
        quality_profile_id: 7,
        root_folder_path: "/custom",
      },
      fakeExtra(),
    );

    expect(ctx.lastBody.value).toMatchObject({
      qualityProfileId: 7,
      rootFolderPath: "/custom",
    });
    expect(ctx.profilesCalled()).toBe(0);
    expect(ctx.foldersCalled()).toBe(0);
  });
});

describe("sonarr_quick_add_series", () => {
  function setUp() {
    const sonarr = new SonarrClient("http://x", "k");
    const lastBody = { value: null as Record<string, unknown> | null };
    let addCalled = false;
    sonarr.addSeries = async (body) => {
      addCalled = true;
      lastBody.value = body as Record<string, unknown>;
      return { id: 42 };
    };
    sonarr.qualityProfiles = async () => oneProfile;
    sonarr.rootFolders = async () => oneFolder;
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_quick_add_series");
    return { sonarr, tool, lastBody, addCalled: () => addCalled };
  }

  test("adds on a single unambiguous match, auto-picking the only profile/folder", async () => {
    const ctx = setUp();
    ctx.sonarr.lookupSeries = async () => [
      { title: "Severance", year: 2022, tvdbId: 371980 },
    ];

    await ctx.tool.callback({ term: "Severance" }, fakeExtra());

    expect(ctx.addCalled()).toBe(true);
    expect(ctx.lastBody.value).toMatchObject({
      title: "Severance",
      tvdbId: 371980,
      qualityProfileId: 4,
      rootFolderPath: "/movies",
      monitored: true,
      seasonFolder: true,
      addOptions: {
        monitor: "all",
        searchForMissingEpisodes: false,
        searchForCutoffUnmetEpisodes: false,
      },
    });
  });

  test("refuses and lists candidates on an ambiguous title match, without adding", async () => {
    const ctx = setUp();
    ctx.sonarr.lookupSeries = async () => [
      { title: "The Office", year: 2001, tvdbId: 1 },
      { title: "The Office", year: 2005, tvdbId: 73244 },
    ];

    await expect(
      ctx.tool.callback({ term: "The Office" }, fakeExtra()),
    ).rejects.toThrow(/matched 2 series.*tvdb_id=1.*tvdb_id=73244/s);
    expect(ctx.addCalled()).toBe(false);
  });

  test("throws with no results and does not add", async () => {
    const ctx = setUp();
    ctx.sonarr.lookupSeries = async () => [];

    await expect(
      ctx.tool.callback({ term: "not a real show" }, fakeExtra()),
    ).rejects.toThrow(/no results/);
    expect(ctx.addCalled()).toBe(false);
  });
});
