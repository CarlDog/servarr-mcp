// Integration tests against a real Radarr instance. Skip when
// RADARR_URL / RADARR_API_KEY aren't set. Read-only ops only.

import { describe, expect, test } from "vitest";
import { RadarrClient } from "./radarr.js";

const url = process.env.RADARR_URL;
const apiKey = process.env.RADARR_API_KEY;
const skip = !url || !apiKey;

describe.skipIf(skip)("Radarr integration", () => {
  const client = new RadarrClient(url ?? "", apiKey ?? "");

  test("health returns an array of HealthResource entries", async () => {
    const result = (await client.health()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });

  test("diskspace returns mount entries", async () => {
    const result = (await client.diskspace()) as Array<{
      freeSpace: number;
      totalSpace: number;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("listMovies returns a non-empty array", async () => {
    const result = (await client.listMovies()) as Array<{
      id: number;
      title: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.id).toBe("number");
  });

  test("lookupMovie('Princess Mononoke') returns TMDB matches", async () => {
    const result = (await client.lookupMovie("Princess Mononoke")) as Array<{
      tmdbId: number;
      title: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // The first hit should be the actual film (tmdbId 128)
    const main = result.find((m) => m.tmdbId === 128);
    expect(main).toBeDefined();
  });

  test("lookupTmdb(128) returns Princess Mononoke directly", async () => {
    const result = (await client.lookupTmdb(128)) as {
      tmdbId: number;
      title: string;
    };
    expect(result.tmdbId).toBe(128);
    expect(typeof result.title).toBe("string");
  });

  test("lookupImdb('tt0119698') returns Princess Mononoke", async () => {
    const result = (await client.lookupImdb("tt0119698")) as {
      imdbId: string;
      title: string;
    };
    expect(result.imdbId).toBe("tt0119698");
    expect(typeof result.title).toBe("string");
  });

  test("calendar returns an array", async () => {
    const result = (await client.calendar()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });

  test("queue (page_size=5) returns a paged result", async () => {
    const result = (await client.queue(1, 5)) as {
      page: number;
      records: Array<unknown>;
    };
    expect(result.page).toBe(1);
    expect(Array.isArray(result.records)).toBe(true);
  });

  test("history returns a paged result", async () => {
    const result = (await client.history(5)) as {
      records: Array<unknown>;
    };
    expect(Array.isArray(result.records)).toBe(true);
  });

  test("wantedMissing returns a paged result", async () => {
    const result = (await client.wantedMissing(5)) as {
      records: Array<unknown>;
    };
    expect(Array.isArray(result.records)).toBe(true);
  });

  test("qualityProfiles returns an array", async () => {
    const result = (await client.qualityProfiles()) as Array<{ id: number }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("rootFolders returns paths", async () => {
    const result = (await client.rootFolders()) as Array<{ path: string }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("tags returns an array", async () => {
    const result = (await client.tags()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });
});
