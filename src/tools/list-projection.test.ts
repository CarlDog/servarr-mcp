import { describe, expect, test } from "vitest";
import {
  asRecordArray,
  projectQueuePage,
  projectRecordArray,
} from "./list-projection.js";

describe("list projection", () => {
  test("projects arrays without dropping falsy selected values", () => {
    expect(
      projectRecordArray(
        [{ id: 1, enabled: false, score: 0, secret: "drop" }],
        ["id", "enabled", "score"],
        "Test endpoint",
      ),
    ).toEqual([{ id: 1, enabled: false, score: 0 }]);
  });

  test("keeps queue pagination metadata and diagnostic status messages", () => {
    const result = projectQueuePage(
      {
        page: 2,
        totalRecords: 3,
        records: [
          {
            id: 9,
            seriesId: 4,
            status: "warning",
            statusMessages: [{ title: "blocked" }],
            quality: { quality: { name: "large" } },
            customFormats: [{ id: 7 }],
          },
        ],
      },
      ["seriesId"],
    );

    expect(result).toEqual({
      page: 2,
      totalRecords: 3,
      records: [
        {
          seriesId: 4,
          id: 9,
          status: "warning",
          statusMessages: [{ title: "blocked" }],
        },
      ],
    });
  });

  test("rejects malformed upstream envelopes", () => {
    expect(() => asRecordArray({}, "List endpoint")).toThrow(/non-array/);
    expect(() => projectQueuePage([], [])).toThrow(/non-object/);
    expect(() => projectQueuePage({}, [])).toThrow(/non-array/);
  });
});
