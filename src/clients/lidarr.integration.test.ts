// Integration tests against a real Lidarr instance. Skip when
// LIDARR_URL / LIDARR_API_KEY aren't set. Read-only ops only.

import { describe, expect, test } from "vitest";
import { LidarrClient } from "./lidarr.js";

const url = process.env.LIDARR_URL;
const apiKey = process.env.LIDARR_API_KEY;
const skip = !url || !apiKey;

describe.skipIf(skip)("Lidarr integration", () => {
  const client = new LidarrClient(url ?? "", apiKey ?? "");

  test("health returns an array", async () => {
    const result = (await client.health()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });

  test("diskspace returns mount entries", async () => {
    const result = (await client.diskspace()) as Array<{
      freeSpace: number;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("listArtists returns a non-empty array", async () => {
    const result = (await client.listArtists()) as Array<{
      id: number;
      artistName: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("lookupArtist('Weird Al') returns MusicBrainz matches", async () => {
    const result = (await client.lookupArtist("Weird Al")) as Array<{
      foreignArtistId: string;
      artistName: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.foreignArtistId).toBe("string");
  });

  test("queue returns a paged result", async () => {
    const result = (await client.queue(1, 5)) as {
      records: Array<unknown>;
    };
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

  test("metadataProfiles returns an array (Lidarr-specific)", async () => {
    const result = (await client.metadataProfiles()) as Array<{ id: number }>;
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
