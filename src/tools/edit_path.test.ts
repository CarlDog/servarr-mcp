// Verify the path + move_files behavior added to the four edit tools
// (mcp-feedback dogfooding, 2026-08-12): path lets a caller set the
// on-disk folder string directly instead of going through
// root_folder_path's relocation logic, and move_files is always passed
// explicitly to the upstream PUT (defaulting to false) rather than
// relying on Servarr's own default.

import { describe, expect, test } from "vitest";
import { LidarrClient } from "../clients/lidarr.js";
import { ReadarrClient } from "../clients/readarr.js";
import { RadarrClient } from "../clients/radarr.js";
import { SonarrClient } from "../clients/sonarr.js";
import { registerLidarrTools } from "./lidarr/index.js";
import { registerReadarrTools } from "./readarr/index.js";
import { registerRadarrTools } from "./radarr/index.js";
import { registerSonarrTools } from "./sonarr/index.js";
import { CaptureServer, fakeExtra } from "./_test_utils.js";

type EditCall = {
  body: Record<string, unknown>;
  moveFiles: boolean | undefined;
};

describe("radarr_edit_movie — path/move_files", () => {
  test("path sets body.path; move_files defaults to false", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    radarr.getMovie = async () => ({ id: 1, title: "X" });
    radarr.editMovie = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_edit_movie");

    await tool.callback({ id: 1, path: "/media/Trending/X" }, fakeExtra());

    expect(lastEdit.value?.body.path).toBe("/media/Trending/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });

  test("move_files: true is passed through explicitly", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    radarr.getMovie = async () => ({ id: 1, title: "X" });
    radarr.editMovie = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_edit_movie");

    await tool.callback(
      { id: 1, root_folder_path: "/media/NewRoot", move_files: true },
      fakeExtra(),
    );

    expect(lastEdit.value?.body.rootFolderPath).toBe("/media/NewRoot");
    expect(lastEdit.value?.moveFiles).toBe(true);
  });

  test("no path/root_folder_path change still passes moveFiles: false explicitly", async () => {
    const radarr = new RadarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    radarr.getMovie = async () => ({ id: 1, title: "X", monitored: false });
    radarr.editMovie = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_edit_movie");

    await tool.callback({ id: 1, monitored: true }, fakeExtra());

    expect(lastEdit.value?.body.monitored).toBe(true);
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("sonarr_edit_series — path/move_files", () => {
  test("path sets body.path; move_files defaults to false", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    sonarr.getSeries = async () => ({ id: 1, title: "X" });
    sonarr.editSeries = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_edit_series");

    await tool.callback({ id: 1, path: "/media/Archived/X" }, fakeExtra());

    expect(lastEdit.value?.body.path).toBe("/media/Archived/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("lidarr_edit_artist — path/move_files", () => {
  test("path sets body.path; move_files defaults to false", async () => {
    const lidarr = new LidarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    lidarr.getArtist = async () => ({ id: 1, artistName: "X" });
    lidarr.editArtist = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerLidarrTools(server as never, lidarr);
    const tool = server.byName("lidarr_edit_artist");

    await tool.callback({ id: 1, path: "/media/Music/X" }, fakeExtra());

    expect(lastEdit.value?.body.path).toBe("/media/Music/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("readarr_edit_author — path/move_files", () => {
  test("path sets body.path; move_files defaults to false", async () => {
    const readarr = new ReadarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    readarr.getAuthor = async () => ({ id: 1, authorName: "X" });
    readarr.editAuthor = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return { ok: true };
    };
    const server = new CaptureServer();
    registerReadarrTools(server as never, readarr);
    const tool = server.byName("readarr_edit_author");

    await tool.callback({ id: 1, path: "/media/Books/X" }, fakeExtra());

    expect(lastEdit.value?.body.path).toBe("/media/Books/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});
