import { describe, expect, test, vi } from "vitest";
import { asText, ServarrClient, withProgress } from "./base.js";

// asText always returns a single-element content array (hardcoded in its
// implementation), so the index access is safe despite
// noUncheckedIndexedAccess. Returns `any` (matching JSON.parse's own
// declared type) so callers can index into the parsed shape freely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAsText(out: ReturnType<typeof asText>): any {
  return JSON.parse(out.content[0]!.text);
}

describe("asText", () => {
  test("wraps data as a single text content block with pretty JSON", () => {
    const out = asText({ a: 1, b: [2, 3] });
    expect(out).toEqual({
      content: [
        { type: "text", text: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}' },
      ],
    });
  });

  describe("secret redaction", () => {
    // Matches Prowlarr's IndexerResource -> fields: Field[] shape
    // (docs/specs/prowlarr.json), the concrete exposure this covers:
    // prowlarr_list_indexers previously returned each indexer's raw
    // apiKey/passkey verbatim.
    test("redacts a Field with privacy: apiKey nested in an array", () => {
      const out = asText([
        {
          id: 1,
          name: "MyIndexer",
          fields: [
            { name: "apiKey", value: "sekret-passkey-123", privacy: "apiKey" },
            {
              name: "baseUrl",
              value: "https://indexer.example",
              privacy: "normal",
            },
          ],
        },
      ]);
      const parsed = parseAsText(out);
      expect(parsed[0].fields[0].value).toBe("[redacted]");
      expect(parsed[0].fields[1].value).toBe("https://indexer.example");
      expect(parsed[0].name).toBe("MyIndexer");
    });

    test.each(["password", "apiKey", "userName"])(
      "redacts privacy: %s",
      (privacy) => {
        const out = asText({
          field: { value: "secret-value", privacy },
        });
        const parsed = parseAsText(out);
        expect(parsed.field.value).toBe("[redacted]");
      },
    );

    test("does not redact privacy: normal", () => {
      const out = asText({
        field: { value: "plain-value", privacy: "normal" },
      });
      const parsed = parseAsText(out);
      expect(parsed.field.value).toBe("plain-value");
    });

    test("leaves objects with a value but no privacy discriminator alone", () => {
      const out = asText({ setting: { value: "not-a-servarr-field" } });
      const parsed = parseAsText(out);
      expect(parsed.setting.value).toBe("not-a-servarr-field");
    });

    test("redacts at arbitrary nesting depth", () => {
      const out = asText({
        level1: {
          level2: { level3: [{ value: "deep-secret", privacy: "password" }] },
        },
      });
      const parsed = parseAsText(out);
      expect(parsed.level1.level2.level3[0].value).toBe("[redacted]");
    });
  });

  describe("URL secret redaction", () => {
    // The concrete exposure: sonarr_history / radarr_history_movie return
    // data.downloadUrl carrying Prowlarr's apikey in plaintext when the
    // indexer is Prowlarr-fronted. Confirmed live on both tools.
    test("redacts apikey from a downloadUrl-shaped field", () => {
      const out = asText({
        data: {
          downloadUrl:
            "http://prowlarr.example:9696/8/download?apikey=abc123def456&link=foo&file=bar",
        },
      });
      const parsed = parseAsText(out);
      expect(parsed.data.downloadUrl).toBe(
        "http://prowlarr.example:9696/8/download?apikey=%5Bredacted%5D&link=foo&file=bar",
      );
      expect(parsed.data.downloadUrl).not.toContain("abc123def456");
    });

    test.each(["apikey", "api_key", "apiKey", "APIKEY", "passkey", "pass_key"])(
      "redacts the %s query param case-insensitively",
      (paramName) => {
        const out = asText({
          url: `https://indexer.example/fetch?${paramName}=sekret&other=1`,
        });
        const parsed = parseAsText(out);
        expect(parsed.url).not.toContain("sekret");
        expect(parsed.url).toContain("other=1");
      },
    );

    test("redacts at any field name, not just downloadUrl", () => {
      const out = asText({
        nzbInfoUrl: "http://usenet.example/info?apikey=hidden-key",
        guid: "http://tracker.example/guid?passkey=hidden-passkey",
      });
      const parsed = parseAsText(out);
      expect(parsed.nzbInfoUrl).not.toContain("hidden-key");
      expect(parsed.guid).not.toContain("hidden-passkey");
    });

    test("redacts every occurrence in a list of history records", () => {
      const out = asText({
        records: Array.from({ length: 3 }, (_, i) => ({
          id: i,
          data: {
            downloadUrl: `http://prowlarr.example:9696/${i}/download?apikey=samekey123`,
          },
        })),
      });
      const parsed = parseAsText(out);
      for (const record of parsed.records) {
        expect(record.data.downloadUrl).not.toContain("samekey123");
      }
    });

    test("leaves a plain URL with no sensitive query params untouched", () => {
      const out = asText({ baseUrl: "https://indexer.example/rss?page=2" });
      const parsed = parseAsText(out);
      expect(parsed.baseUrl).toBe("https://indexer.example/rss?page=2");
    });

    test("leaves a non-URL string containing 'apikey' as a substring alone", () => {
      const out = asText({ note: "the apikey=... pattern isn't a real URL" });
      const parsed = parseAsText(out);
      expect(parsed.note).toBe("the apikey=... pattern isn't a real URL");
    });

    test("does not affect a plain string with no query-shaped substring", () => {
      const out = asText({ title: "Some Movie (2026)" });
      const parsed = parseAsText(out);
      expect(parsed.title).toBe("Some Movie (2026)");
    });
  });
});

describe("withProgress", () => {
  test("skips emission and just runs fn when no progressToken", async () => {
    const sendNotification = vi.fn(async () => undefined);
    const result = await withProgress(
      { sendNotification }, // no _meta
      () => "msg",
      10,
      async () => "done",
    );
    expect(result).toBe("done");
    expect(sendNotification).not.toHaveBeenCalled();
  });

  test("emits progress notifications on the timer when token present", async () => {
    vi.useFakeTimers();
    try {
      const sendNotification = vi.fn(async () => undefined);
      const extra = {
        _meta: { progressToken: "tok-1" as const },
        sendNotification,
      };

      // fn that resolves after we've advanced the clock past two ticks
      let resolveFn: (v: string) => void = () => undefined;
      const slow = new Promise<string>((res) => {
        resolveFn = res;
      });
      const promise = withProgress(
        extra,
        (s) => `still working ${s}s`,
        100,
        () => slow,
      );

      // advance to fire two timer ticks
      await vi.advanceTimersByTimeAsync(250);
      expect(sendNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
      const calls = sendNotification.mock.calls as unknown as Array<
        [
          {
            method: string;
            params: {
              progressToken: unknown;
              message: string;
              progress: number;
            };
          },
        ]
      >;
      const firstArg = calls[0]?.[0];
      expect(firstArg?.method).toBe("notifications/progress");
      expect(firstArg?.params.progressToken).toBe("tok-1");
      expect(firstArg?.params.message).toContain("still working");
      expect(typeof firstArg?.params.progress).toBe("number");

      resolveFn("done");
      await expect(promise).resolves.toBe("done");
    } finally {
      vi.useRealTimers();
    }
  });

  test("clears the interval after fn rejects", async () => {
    vi.useFakeTimers();
    try {
      const sendNotification = vi.fn(async () => undefined);
      const extra = {
        _meta: { progressToken: 42 as const },
        sendNotification,
      };
      const promise = withProgress(
        extra,
        () => "x",
        100,
        async () => {
          throw new Error("boom");
        },
      );
      await expect(promise).rejects.toThrow("boom");

      const callsAtFail = sendNotification.mock.calls.length;
      // advance well past the interval; no further emissions should land
      await vi.advanceTimersByTimeAsync(1000);
      expect(sendNotification.mock.calls.length).toBe(callsAtFail);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("request query serialization", () => {
  test("array params serialize as repeated keys (ASP.NET List<int> binding)", async () => {
    const { ProwlarrClient } = await import("./prowlarr.js");
    let captured: URL | undefined;
    const fetchStub = vi.fn(async (url: URL) => {
      captured = url;
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchStub);
    try {
      const client = new ProwlarrClient("http://prowlarr.test:9696", "key");
      await client.search("ubuntu", [1, 2], [2000, 5000]);
      expect(captured).toBeDefined();
      expect(captured?.searchParams.get("query")).toBe("ubuntu");
      expect(captured?.searchParams.getAll("indexerIds")).toEqual(["1", "2"]);
      expect(captured?.searchParams.getAll("categories")).toEqual([
        "2000",
        "5000",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("outbound request headers", () => {
  // X-Api-Key is set independently in all five request helpers. Nothing
  // asserted it, so a sixth helper — or an edit to one of the five — could
  // ship unauthenticated and only fail against a live *arr instance, which
  // CI never reaches (the integration suites skip without credentials).
  class HeaderProbe extends ServarrClient {
    get = (path: string) => this.request<unknown>(path);
    post = (path: string, body: unknown) =>
      this.requestPost<unknown>(path, body);
    put = (path: string, body: unknown) => this.requestPut<unknown>(path, body);
    postVoid = (path: string, body: unknown) =>
      this.requestPostVoid(path, body);
    del = (path: string) => this.requestDelete(path);
  }

  const config = {
    url: "http://sonarr.test:8989",
    apiKey: "secret-key",
    apiPath: "/api/v3",
    appName: "Sonarr",
  };

  async function capture(drive: (c: HeaderProbe) => Promise<unknown>) {
    let url: URL | undefined;
    let init: RequestInit | undefined;
    const stub = vi.fn(async (u: URL, i: RequestInit) => {
      url = u;
      init = i;
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", stub);
    try {
      await drive(new HeaderProbe(config));
    } finally {
      vi.unstubAllGlobals();
    }
    return { url, headers: (init?.headers ?? {}) as Record<string, string> };
  }

  const methods: Array<[string, (c: HeaderProbe) => Promise<unknown>]> = [
    ["request", (c) => c.get("/series")],
    ["requestPost", (c) => c.post("/series", { title: "x" })],
    ["requestPut", (c) => c.put("/series/1", { title: "x" })],
    ["requestPostVoid", (c) => c.postVoid("/history/failed/1", {})],
    ["requestDelete", (c) => c.del("/queue/1")],
  ];

  for (const [name, drive] of methods) {
    test(`${name} sends the API key`, async () => {
      const { headers } = await capture(drive);
      expect(headers["X-Api-Key"]).toBe("secret-key");
    });

    test(`${name} targets the configured host and api path`, async () => {
      const { url } = await capture(drive);
      expect(url?.origin).toBe("http://sonarr.test:8989");
      expect(url?.pathname.startsWith("/api/v3/")).toBe(true);
    });
  }

  test("write helpers declare a JSON body", async () => {
    for (const [, drive] of methods.slice(1, 4)) {
      const { headers } = await capture(drive);
      expect(headers["Content-Type"]).toBe("application/json");
    }
  });
});
