import { describe, expect, test, vi } from "vitest";
import { asText, withProgress } from "./base.js";

describe("asText", () => {
  test("wraps data as a single text content block with pretty JSON", () => {
    const out = asText({ a: 1, b: [2, 3] });
    expect(out).toEqual({
      content: [
        { type: "text", text: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}' },
      ],
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
