// Integration tests against a real Sonarr instance. Skips entire
// suite when SONARR_URL / SONARR_API_KEY aren't set (CI doesn't have
// them; tests stay green there). Read-only operations only — no
// add / edit / search / history-mark-failed against a production
// library.

import { describe, expect, test } from "vitest";
import { SonarrClient } from "./sonarr.js";

const url = process.env.SONARR_URL;
const apiKey = process.env.SONARR_API_KEY;
const skip = !url || !apiKey;

describe.skipIf(skip)("Sonarr integration", () => {
  const client = new SonarrClient(url ?? "", apiKey ?? "");

  test("health returns an array of HealthResource entries", async () => {
    const result = (await client.health()) as Array<{
      source: string;
      type: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("source");
      expect(result[0]).toHaveProperty("type");
    }
  });

  test("diskspace returns mount entries with free/total bytes", async () => {
    const result = (await client.diskspace()) as Array<{
      freeSpace: number;
      totalSpace: number;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.freeSpace).toBe("number");
    expect(typeof result[0]?.totalSpace).toBe("number");
  });

  test("listSeries returns a non-empty array of SeriesResource", async () => {
    const result = (await client.listSeries()) as Array<{
      id: number;
      title: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.id).toBe("number");
    expect(typeof result[0]?.title).toBe("string");
  });

  test("lookupSeries('Daredevil') returns TVDB matches", async () => {
    const result = (await client.lookupSeries("Daredevil")) as Array<{
      tvdbId: number;
      title: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Daredevil should have a numeric tvdbId
    expect(typeof result[0]?.tvdbId).toBe("number");
  });

  test("calendar returns an array (possibly empty for narrow window)", async () => {
    const result = (await client.calendar()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });

  test("queue (page 1) returns a paged result with records array", async () => {
    const result = (await client.queue(1, 5)) as {
      page: number;
      records: Array<unknown>;
    };
    expect(result.page).toBe(1);
    expect(Array.isArray(result.records)).toBe(true);
  });

  test("history (page_size=5) returns a paged result", async () => {
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

  test("qualityProfiles returns an array with id/name", async () => {
    const result = (await client.qualityProfiles()) as Array<{
      id: number;
      name: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.id).toBe("number");
  });

  test("rootFolders returns an array with paths", async () => {
    const result = (await client.rootFolders()) as Array<{ path: string }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.path).toBe("string");
  });

  test("tags returns an array (possibly empty)", async () => {
    const result = (await client.tags()) as Array<{
      id: number;
      label: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(typeof result[0]?.id).toBe("number");
      expect(typeof result[0]?.label).toBe("string");
    }
  });
});
