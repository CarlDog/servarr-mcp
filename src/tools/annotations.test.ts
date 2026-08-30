// REQUIRED ENFORCEMENT TEST — standard MCP-T01.
//
// Coverage test: every registered tool must declare MCP annotations.
// Catches future drift where a new tool ships without the safety/
// discoverability hints (readOnlyHint, destructiveHint, etc.).

import { describe, expect, test } from "vitest";
import { LidarrClient } from "../clients/lidarr.js";
import { ProwlarrClient } from "../clients/prowlarr.js";
import { RadarrClient } from "../clients/radarr.js";
import { ReadarrClient } from "../clients/readarr.js";
import { SonarrClient } from "../clients/sonarr.js";
import { registerLidarrTools } from "./lidarr/index.js";
import { registerProwlarrTools } from "./prowlarr/index.js";
import { registerRadarrTools } from "./radarr/index.js";
import { registerReadarrTools } from "./readarr/index.js";
import { registerSonarrTools } from "./sonarr/index.js";
import { CaptureServer } from "./_test_utils.js";

function captureAll() {
  const server = new CaptureServer();
  // URLs/keys irrelevant — clients are never invoked, just registered.
  registerSonarrTools(server as never, new SonarrClient("http://x", "k"));
  registerRadarrTools(server as never, new RadarrClient("http://x", "k"));
  registerLidarrTools(server as never, new LidarrClient("http://x", "k"));
  registerReadarrTools(server as never, new ReadarrClient("http://x", "k"));
  registerProwlarrTools(server as never, new ProwlarrClient("http://x", "k"));
  return server.tools;
}

describe("tool annotations", () => {
  const tools = captureAll();

  test("there are at least 100 tools registered (sanity)", () => {
    expect(tools.length).toBeGreaterThanOrEqual(100);
  });

  test("every tool has an annotations object", () => {
    const missing = tools.filter((t) => !t.config.annotations);
    expect(missing.map((t) => t.name)).toEqual([]);
  });

  test("annotations are consistent with tool category", () => {
    const checks: Array<{ pattern: RegExp; field: string; expected: boolean }> =
      [
        // reads: readOnlyHint must be true
        {
          pattern:
            /_(list|get|lookup|health|diskspace|calendar|wanted|history|queue|search|trackfiles|stats|status|indexers)$/,
          field: "readOnlyHint",
          expected: true,
        },
        {
          pattern: /_history_(series|movie|artist|author)$/,
          field: "readOnlyHint",
          expected: true,
        },
        { pattern: /_release_search$/, field: "readOnlyHint", expected: true },
        { pattern: /_get_command$/, field: "readOnlyHint", expected: true },
        {
          pattern: /_list_(import_lists|notifications)$/,
          field: "readOnlyHint",
          expected: true,
        },
        // writes: readOnlyHint must NOT be true (i.e., undefined or false)
        { pattern: /_grab_release$/, field: "readOnlyHint", expected: false },
        {
          pattern: /_(add|edit)_[a-z]+$/,
          field: "readOnlyHint",
          expected: false,
        },
        {
          pattern: /_queue_(remove|regrab)$/,
          field: "readOnlyHint",
          expected: false,
        },
        {
          pattern: /_history_mark_failed$/,
          field: "readOnlyHint",
          expected: false,
        },
        { pattern: /_refresh_[a-z]+$/, field: "readOnlyHint", expected: false },
        {
          pattern: /_set_(import_list_state|notification_manual_interaction)$/,
          field: "readOnlyHint",
          expected: false,
        },
      ];

    for (const { pattern, field, expected } of checks) {
      for (const t of tools) {
        if (!pattern.test(t.name)) continue;
        const ann = t.config.annotations as Record<string, unknown> | undefined;
        const actual = Boolean(ann?.[field]);
        if (actual !== expected) {
          throw new Error(
            `tool ${t.name}: expected annotations.${field}=${expected}, got ${actual}`,
          );
        }
      }
    }
  });

  test("destructive write tools carry destructiveHint", () => {
    const destructiveSuffixes = [
      /_queue_remove$/,
      /_history_mark_failed$/,
      /_edit_[a-z]+$/,
      /_set_(import_list_state|notification_manual_interaction)$/,
    ];
    for (const t of tools) {
      if (!destructiveSuffixes.some((p) => p.test(t.name))) continue;
      const ann = t.config.annotations as Record<string, unknown> | undefined;
      expect(
        ann?.destructiveHint,
        `${t.name} should have destructiveHint=true`,
      ).toBe(true);
    }
  });

  test("external-fanout tools carry openWorldHint", () => {
    const externalPatterns = [
      /_lookup_/,
      /_release_search$/,
      /_grab_release$/,
      /_(search|refresh)_/,
      /_history_mark_failed$/,
      /_queue_(remove|regrab)$/,
      /^prowlarr_search$/,
    ];
    for (const t of tools) {
      if (!externalPatterns.some((p) => p.test(t.name))) continue;
      // skip release_search guard if name doesn't actually match external
      if (t.name === "prowlarr_indexer_status") continue;
      const ann = t.config.annotations as Record<string, unknown> | undefined;
      expect(
        ann?.openWorldHint,
        `${t.name} should have openWorldHint=true`,
      ).toBe(true);
    }
  });
});
