import { afterEach, describe, expect, test, vi } from "vitest";
import { SonarrClient } from "../clients/sonarr.js";
import { handleQueueRemove } from "./queue-remove.js";

describe("queue removal", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("preserves the single-id path and safe defaults", async () => {
    const client = {
      queueRemove: vi.fn(async () => undefined),
      queueRemoveBulk: vi.fn(async () => undefined),
    };

    await handleQueueRemove(client, { id: 7 });

    expect(client.queueRemove).toHaveBeenCalledWith(7, {
      removeFromClient: false,
      blocklist: false,
      skipRedownload: false,
      changeCategory: false,
    });
    expect(client.queueRemoveBulk).not.toHaveBeenCalled();
  });

  test("uses one bulk call with exact ids and flags", async () => {
    const client = {
      queueRemove: vi.fn(async () => undefined),
      queueRemoveBulk: vi.fn(async () => undefined),
    };

    await handleQueueRemove(client, {
      ids: [11, 12, 13],
      confirm: true,
      blocklist: true,
      skip_redownload: true,
    });

    expect(client.queueRemoveBulk).toHaveBeenCalledWith([11, 12, 13], {
      removeFromClient: false,
      blocklist: true,
      skipRedownload: true,
      changeCategory: false,
    });
    expect(client.queueRemove).not.toHaveBeenCalled();
  });

  test("refuses bulk removal without confirmation", async () => {
    const client = {
      queueRemove: vi.fn(async () => undefined),
      queueRemoveBulk: vi.fn(async () => undefined),
    };

    await expect(handleQueueRemove(client, { ids: [1] })).rejects.toThrow(
      "confirm: true",
    );
    expect(client.queueRemoveBulk).not.toHaveBeenCalled();
  });

  test("refuses ambiguous and duplicate selections", async () => {
    const client = {
      queueRemove: vi.fn(async () => undefined),
      queueRemoveBulk: vi.fn(async () => undefined),
    };

    await expect(
      handleQueueRemove(client, { id: 1, ids: [2], confirm: true }),
    ).rejects.toThrow("exactly one");
    await expect(
      handleQueueRemove(client, { ids: [2, 2], confirm: true }),
    ).rejects.toThrow("unique positive integers");
  });

  test("sends the official DELETE bulk request shape", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response("", { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SonarrClient("http://sonarr:8989", "secret");

    await client.queueRemoveBulk([21, 22], {
      removeFromClient: false,
      blocklist: true,
      skipRedownload: false,
      changeCategory: false,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/api/v3/queue/bulk?");
    expect(String(url)).toContain("removeFromClient=false");
    expect(String(url)).toContain("blocklist=true");
    expect(init).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ ids: [21, 22] }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });
});
