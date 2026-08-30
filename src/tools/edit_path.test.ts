// Verify the path + move_files behavior of the four edit tools. A
// root_folder_path edit must derive and send the full path because the
// Servarr APIs silently ignore rootFolderPath alone on existing items.
// The handlers also reject a success-shaped response that reports the
// old path, while move_files is always explicit (default false).

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
import { rebaseServarrPath } from "./edit-path.js";

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
      return body;
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
    radarr.getMovie = async () => ({
      id: 1,
      title: "X",
      path: "/media/OldRoot/X",
    });
    radarr.editMovie = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return body;
    };
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_edit_movie");

    await tool.callback(
      { id: 1, root_folder_path: "/media/NewRoot", move_files: true },
      fakeExtra(),
    );

    expect(lastEdit.value?.body.rootFolderPath).toBe("/media/NewRoot");
    expect(lastEdit.value?.body.path).toBe("/media/NewRoot/X");
    expect(lastEdit.value?.moveFiles).toBe(true);
  });

  test("rejects a success-shaped response that still reports the old path", async () => {
    const radarr = new RadarrClient("http://x", "k");
    radarr.getMovie = async () => ({
      id: 1,
      title: "X",
      path: "/media/OldRoot/X",
    });
    radarr.editMovie = async () => ({
      id: 1,
      title: "X",
      path: "/media/OldRoot/X",
      rootFolderPath: "/media/OldRoot",
    });
    const server = new CaptureServer();
    registerRadarrTools(server as never, radarr);
    const tool = server.byName("radarr_edit_movie");

    await expect(
      tool.callback(
        { id: 1, root_folder_path: "/media/NewRoot", move_files: true },
        fakeExtra(),
      ),
    ).rejects.toThrow(
      /path update did not take effect.*expected \/media\/NewRoot\/X.*returned \/media\/OldRoot\/X/,
    );
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
  test("root_folder_path derives body.path; move_files defaults to false", async () => {
    const sonarr = new SonarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    sonarr.getSeries = async () => ({
      id: 1,
      title: "X",
      path: "/media/Old/X",
    });
    sonarr.editSeries = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return body;
    };
    const server = new CaptureServer();
    registerSonarrTools(server as never, sonarr);
    const tool = server.byName("sonarr_edit_series");

    await tool.callback(
      { id: 1, root_folder_path: "/media/Archived" },
      fakeExtra(),
    );

    expect(lastEdit.value?.body.path).toBe("/media/Archived/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("lidarr_edit_artist — path/move_files", () => {
  test("root_folder_path derives body.path; move_files defaults to false", async () => {
    const lidarr = new LidarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    lidarr.getArtist = async () => ({
      id: 1,
      artistName: "X",
      path: "/media/Old/X",
    });
    lidarr.editArtist = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return body;
    };
    const server = new CaptureServer();
    registerLidarrTools(server as never, lidarr);
    const tool = server.byName("lidarr_edit_artist");

    await tool.callback(
      { id: 1, root_folder_path: "/media/Music" },
      fakeExtra(),
    );

    expect(lastEdit.value?.body.path).toBe("/media/Music/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("readarr_edit_author — path/move_files", () => {
  test("root_folder_path derives body.path; move_files defaults to false", async () => {
    const readarr = new ReadarrClient("http://x", "k");
    const lastEdit = { value: null as EditCall | null };
    readarr.getAuthor = async () => ({
      id: 1,
      authorName: "X",
      path: "/media/Old/X",
    });
    readarr.editAuthor = async (_id, body, moveFiles) => {
      lastEdit.value = { body: body as Record<string, unknown>, moveFiles };
      return body;
    };
    const server = new CaptureServer();
    registerReadarrTools(server as never, readarr);
    const tool = server.byName("readarr_edit_author");

    await tool.callback(
      { id: 1, root_folder_path: "/media/Books" },
      fakeExtra(),
    );

    expect(lastEdit.value?.body.path).toBe("/media/Books/X");
    expect(lastEdit.value?.moveFiles).toBe(false);
  });
});

describe("rebaseServarrPath", () => {
  test("preserves a Windows leaf folder under a Windows root", () => {
    expect(rebaseServarrPath("D:\\TV\\Old\\Show", "E:\\TV")).toBe(
      "E:\\TV\\Show",
    );
  });
});
