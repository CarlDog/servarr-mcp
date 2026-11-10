// Exercise the HTTP transport against a loopback harness, not a simulated
// Servarr API. These tests assert timeout/retry policy, not upstream contracts.
import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  INDEXER_SEARCH_TIMEOUT_MS,
  ServarrClient,
  type RequestOptions,
} from "./base.js";
import { ProwlarrClient } from "./prowlarr.js";

class TransportClient extends ServarrClient {
  constructor(url: string) {
    super({ url, apiKey: "test-key", apiPath: "", appName: "Transport test" });
  }

  read(options: RequestOptions = {}) {
    return this.request("/read", {}, options);
  }

  write(method: string) {
    switch (method) {
      case "POST":
        return this.requestPost("/write", {});
      case "POST_VOID":
        return this.requestPostVoid("/write", {});
      case "PUT":
        return this.requestPut("/write", {});
      case "DELETE":
        return this.requestDelete("/write");
      default:
        throw new Error("Unexpected test method");
    }
  }
}

const servers: Server[] = [];

async function listen(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});

describe("outbound request policy", () => {
  test("ordinary GET retries 429, with at most four attempts", async () => {
    let calls = 0;
    const url = await listen((_request, response) => {
      calls++;
      response.writeHead(429, { "Retry-After": "0.001" });
      response.end("rate limited");
    });

    await expect(new TransportClient(url).read()).rejects.toMatchObject({
      status: 429,
    });
    expect(calls).toBe(4);
  });

  test("ordinary GET retries a transient 503 then returns the response", async () => {
    let calls = 0;
    const url = await listen((_request, response) => {
      calls++;
      response.writeHead(calls === 1 ? 503 : 200, { "Retry-After": "0.001" });
      response.end(calls === 1 ? "unavailable" : '{"ok":true}');
    });

    await expect(new TransportClient(url).read()).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(2);
  });

  test("ordinary GET retries a transport failure", async () => {
    let calls = 0;
    const url = await listen((request, response) => {
      calls++;
      if (calls === 1) request.socket.destroy();
      else response.end('{"ok":true}');
    });

    await expect(new TransportClient(url).read()).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(2);
  });

  test("ordinary GET does not retry a permanent 400", async () => {
    let calls = 0;
    const url = await listen((_request, response) => {
      calls++;
      response.writeHead(400);
      response.end("bad request");
    });

    await expect(new TransportClient(url).read()).rejects.toMatchObject({
      status: 400,
    });
    expect(calls).toBe(1);
  });

  test.each(["headers", "body"])(
    "retry:false bounds a stalled %s read to one attempt",
    async (phase) => {
      let calls = 0;
      const url = await listen((_request, response) => {
        calls++;
        if (phase === "body") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.write('{"unfinished":');
        }
      });

      await expect(
        new TransportClient(url).read({ retry: false, timeoutMs: 1000 }),
      ).rejects.toThrow("timed out after 1000ms");
      expect(calls).toBe(1);
    },
  );

  test.each([429, 503, "disconnect"] as const)(
    "indexer searches do not retry %s",
    async (failure) => {
      const calls: string[] = [];
      const url = await listen((request, response) => {
        calls.push(request.url!);
        if (failure === "disconnect") request.socket.destroy();
        else {
          response.writeHead(failure, { "Retry-After": "0.001" });
          response.end("upstream failure");
        }
      });
      const client = new TransportClient(url);
      const prowlarr = new ProwlarrClient(url, "test-key");

      await expect(
        client.searchReleases({ movieId: 12 }),
      ).rejects.toBeDefined();
      await expect(prowlarr.search("example")).rejects.toBeDefined();
      expect(calls).toEqual([
        "/release?movieId=12",
        "/api/v1/search?query=example",
      ]);
    },
  );

  test.each(["POST", "POST_VOID", "PUT", "DELETE"])(
    "%s never retries rate limits, server failures or transport failures",
    async (method) => {
      for (const failure of [429, 503, "disconnect"] as const) {
        let calls = 0;
        const url = await listen((request, response) => {
          calls++;
          expect(request.method).toBe(method === "POST_VOID" ? "POST" : method);
          if (failure === "disconnect") request.socket.destroy();
          else {
            response.writeHead(failure, { "Retry-After": "0.001" });
            response.end("upstream failure");
          }
        });

        await expect(
          new TransportClient(url).write(method),
        ).rejects.toBeDefined();
        expect(calls).toBe(1);
      }
    },
  );

  test("searches arm a 120-second deadline and ordinary reads keep 30 seconds", async () => {
    const url = await listen((_request, response) => response.end("[]"));
    // Observe real timers without replacing fetch or the upstream response.
    const timers = vi.spyOn(globalThis, "setTimeout");
    const client = new TransportClient(url);

    await client.searchReleases({ movieId: 12, episodeId: undefined });
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 120_000);
    expect(INDEXER_SEARCH_TIMEOUT_MS).toBe(120_000);

    timers.mockClear();
    await new ProwlarrClient(url, "test-key").search("example", [1, 2], [2000]);
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 120_000);

    timers.mockClear();
    await client.read();
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });
});
