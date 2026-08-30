import { describe, expect, test } from "vitest";
import { auditReferencedRoots } from "./root-audit.js";

describe("referenced-root audit", () => {
  test("normalizes trailing separators and reports exact healthy references", () => {
    const result = auditReferencedRoots(
      [{ path: "/media/tv/" }],
      [{ id: 1, path: "/media/tv/Show", rootFolderPath: "/media/tv" }],
    );

    expect(result.summary).toMatchObject({
      configured_root_count: 1,
      library_record_count: 1,
      ok_count: 1,
      issue_count: 0,
      exact_reference_count: 1,
      exact_path_count: 1,
    });
    expect(result.records[0]).toMatchObject({
      reference_match: "exact",
      path_relation: "exact",
      has_issue: false,
    });
  });

  test("distinguishes case-only roots from unconfigured roots", () => {
    const result = auditReferencedRoots(
      [{ path: "/media/tv" }],
      [
        { id: 2, path: "/Media/TV/Show", rootFolderPath: "/Media/TV" },
        { id: 3, path: "/archive/tv/Show", rootFolderPath: "/archive/tv" },
      ],
    );

    expect(result.summary).toMatchObject({
      case_only_reference_count: 1,
      unconfigured_reference_count: 1,
      issue_count: 2,
    });
    expect(result.records.map((record) => record.reference_match)).toEqual([
      "case_only",
      "unconfigured",
    ]);
  });

  test("infers the longest configured root when rootFolderPath is absent", () => {
    const result = auditReferencedRoots(
      [{ path: "/media" }, { path: "/media/tv" }],
      [{ id: 4, path: "/media/tv/Show" }],
    );

    expect(result.records[0]).toMatchObject({
      referenced_root: "/media/tv",
      configured_root: "/media/tv",
      reference_source: "inferred_from_path",
      reference_match: "exact",
      has_issue: false,
    });
  });

  test("reports missing references and paths outside reported roots", () => {
    const result = auditReferencedRoots(
      [{ path: "/media/tv" }],
      [
        { id: 5, path: "/unknown/Show" },
        { id: 6, path: "/other/Show", rootFolderPath: "/media/tv" },
      ],
    );

    expect(result.summary).toMatchObject({
      missing_reference_count: 1,
      outside_path_count: 1,
      issue_count: 2,
    });
    expect(result.records[0]).toMatchObject({
      reference_source: "missing",
      reference_match: "missing",
      path_relation: "missing",
    });
    expect(result.records[1]).toMatchObject({
      reference_match: "exact",
      path_relation: "outside",
    });
  });

  test("rejects malformed upstream response envelopes", () => {
    expect(() => auditReferencedRoots({}, [])).toThrow(/non-array/);
    expect(() => auditReferencedRoots([], {})).toThrow(/non-array/);
  });
});
