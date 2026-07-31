import { describe, expect, test, vi } from "vitest";
import { asText, withProgress } from "./base.js";

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
