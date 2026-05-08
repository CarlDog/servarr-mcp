import { describe, expect, test } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  pickFields,
} from "./_paging.js";

describe("paginate", () => {
  const items = Array.from({ length: 137 }, (_, i) => ({ id: i + 1 }));

  test("first page with default size", () => {
    const result = paginate(items);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(DEFAULT_PAGE_SIZE);
    expect(result.total_records).toBe(137);
    expect(result.records).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.records[0]).toEqual({ id: 1 });
  });

  test("nth page with explicit size", () => {
    const result = paginate(items, 3, 25);
    expect(result.page).toBe(3);
    expect(result.page_size).toBe(25);
    expect(result.records).toHaveLength(25);
    expect(result.records[0]).toEqual({ id: 51 });
  });

  test("page past the end returns empty records but correct total", () => {
    const result = paginate(items, 99, 25);
    expect(result.records).toEqual([]);
    expect(result.total_records).toBe(137);
  });

  test("page_size larger than total returns everything", () => {
    const result = paginate(items, 1, MAX_PAGE_SIZE);
    expect(result.records).toHaveLength(137);
  });
});

describe("pickFields", () => {
  test("keeps requested fields, drops the rest", () => {
    const movie = {
      id: 17603,
      title: "Princess Mononoke",
      overview: "Long string we want to drop.",
      images: [{ coverType: "poster", url: "..." }],
      monitored: true,
    };
    const slim = pickFields(movie, ["id", "title", "monitored"] as const);
    expect(slim).toEqual({
      id: 17603,
      title: "Princess Mononoke",
      monitored: true,
    });
    expect("overview" in slim).toBe(false);
    expect("images" in slim).toBe(false);
  });

  test("missing fields are simply omitted (not set to undefined)", () => {
    const partial = { id: 1, title: "x" };
    const slim = pickFields(partial, ["id", "title", "missing"] as const);
    expect(slim).toEqual({ id: 1, title: "x" });
    expect("missing" in slim).toBe(false);
  });

  test("preserves null and falsy values", () => {
    const movie = {
      id: 1,
      title: "x",
      hasFile: false,
      imdbId: null,
      sizeOnDisk: 0,
    };
    const slim = pickFields(movie, [
      "id",
      "hasFile",
      "imdbId",
      "sizeOnDisk",
    ] as const);
    expect(slim).toEqual({
      id: 1,
      hasFile: false,
      imdbId: null,
      sizeOnDisk: 0,
    });
  });
});
