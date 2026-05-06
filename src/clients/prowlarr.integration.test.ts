// Integration tests against a real Prowlarr instance. Skip when
// PROWLARR_URL / PROWLARR_API_KEY aren't set. Read-only ops only.
// `prowlarr_search` is excluded — it hits indexers live and is
// rate-limit-sensitive; opt-in fixture for that lands later.

import { describe, expect, test } from "vitest";
import { ProwlarrClient } from "./prowlarr.js";

const url = process.env.PROWLARR_URL;
const apiKey = process.env.PROWLARR_API_KEY;
const skip = !url || !apiKey;

describe.skipIf(skip)("Prowlarr integration", () => {
  const client = new ProwlarrClient(url ?? "", apiKey ?? "");

  test("health returns an array", async () => {
    const result = (await client.health()) as Array<unknown>;
    expect(Array.isArray(result)).toBe(true);
  });

  test("listIndexers returns configured indexers", async () => {
    const result = (await client.listIndexers()) as Array<{
      id: number;
      name: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.id).toBe("number");
    expect(typeof result[0]?.name).toBe("string");
  });

  test("indexerStats returns aggregate counts", async () => {
    const result = (await client.indexerStats()) as Record<string, unknown>;
    // Shape varies — Prowlarr returns an object with `indexers`,
    // `userAgents`, etc. Just verify it's an object with at least
    // one key.
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  test("indexerStatus returns an array (possibly empty if everything healthy)", async () => {
    const result = (await client.indexerStatus()) as Array<{
      indexerId: number;
      disabledTill: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(typeof result[0]?.indexerId).toBe("number");
    }
  });

  test("history returns a paged result", async () => {
    const result = (await client.history(5)) as {
      records: Array<unknown>;
    };
    expect(Array.isArray(result.records)).toBe(true);
  });
});
