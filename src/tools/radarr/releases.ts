import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ANN_GRAB,
  ANN_READ_EXT,
  asText,
  withProgress,
} from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerReleaseTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_release_search",
    {
      title: "Radarr: Release Search",
      description:
        "Run a live indexer search for releases of a specific movie and return candidate ReleaseResource entries (without grabbing). Hits every enabled indexer in real time — slow and rate-limit-sensitive, so call only when the user wants to pick a release manually. Returned items feed `radarr_grab_release`.",
      inputSchema: {
        movie_id: z
          .number()
          .int()
          .describe("The Radarr movie id (from radarr_list_movies)."),
      },
      annotations: ANN_READ_EXT,
    },
    async ({ movie_id }, extra) =>
      withProgress(
        extra,
        (s) =>
          `Radarr: searching indexers for movie ${movie_id}… (${s}s elapsed)`,
        20000,
        async () => asText(await radarr.searchReleases({ movieId: movie_id })),
      ),
  );

  server.registerTool(
    "radarr_grab_release",
    {
      title: "Radarr: Grab Release",
      description:
        "HIGH RISK. Immediately queues a download from the indexer for the given release. Pass the `release` object verbatim from `radarr_release_search` output — Radarr looks the release up server-side by guid+indexerId, so the cache must still be warm (re-run release_search if the grab fails with a 'not found' error). If the release was rejected by the quality profile (e.g. wrong resolution), set `should_override` to true to grab anyway.",
      inputSchema: {
        release: z
          .object({
            guid: z.string(),
            indexerId: z.number().int(),
          })
          .passthrough()
          .describe(
            "The ReleaseResource object returned by radarr_release_search. Pass it verbatim — guid + indexerId are what Radarr keys on; other fields ride along.",
          ),
        should_override: z
          .boolean()
          .optional()
          .describe(
            "Force-grab a release even if the quality profile rejected it (default false). Mirrors Radarr's UI 'Override and Download' button.",
          ),
      },
      annotations: ANN_GRAB,
    },
    async ({ release, should_override = false }) => {
      const body: Record<string, unknown> = { ...release };
      // Servarr's POST /release wants movieId, but GET /release returns it
      // null and puts the parsed match in mappedMovieId. Copy it across
      // unless the caller already set movieId explicitly.
      if (body.movieId === undefined && body.mappedMovieId !== undefined) {
        body.movieId = body.mappedMovieId;
      }
      if (should_override) body.shouldOverride = true;
      return asText(await radarr.grabRelease(body));
    },
  );
}
