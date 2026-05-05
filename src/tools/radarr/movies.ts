import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";

export function registerMovieTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_add_movie",
    {
      title: "Radarr: Add Movie",
      description:
        "Add a new movie to Radarr by TMDB id. Internally calls /movie/lookup to fetch the full movie metadata, then POSTs /movie with the merged body. Returns the created MovieResource. " +
        "Workflow: call radarr_lookup_movie first to get the tmdbId, radarr_list_quality_profiles for quality_profile_id, radarr_list_root_folders for root_folder_path. " +
        "Note: search_for_movie defaults to false here — Radarr's server-side default is true, which may immediately hit indexers; flip explicitly if you want that.",
      inputSchema: {
        tmdb_id: z
          .number()
          .int()
          .describe("The TMDB id of the movie to add (from radarr_lookup_movie)."),
        quality_profile_id: z
          .number()
          .int()
          .describe("Quality profile id (from radarr_list_quality_profiles)."),
        root_folder_path: z
          .string()
          .describe("Root folder path (from radarr_list_root_folders)."),
        monitored: z
          .boolean()
          .optional()
          .describe("Track this movie for missing files (default true)."),
        search_for_movie: z
          .boolean()
          .optional()
          .describe(
            "Trigger a search for the movie immediately on add (default false).",
          ),
      },
    },
    async ({
      tmdb_id,
      quality_profile_id,
      root_folder_path,
      monitored = true,
      search_for_movie = false,
    }) => {
      const lookup = (await radarr.lookupMovie(
        `tmdb:${tmdb_id}`,
      )) as Array<Record<string, unknown>>;
      if (!Array.isArray(lookup) || lookup.length === 0) {
        throw new Error(
          `Radarr lookup returned no results for TMDB id ${tmdb_id}.`,
        );
      }
      const movie = lookup[0];
      const body = {
        ...movie,
        qualityProfileId: quality_profile_id,
        rootFolderPath: root_folder_path,
        monitored,
        addOptions: {
          searchForMovie: search_for_movie,
        },
      };
      return asText(await radarr.addMovie(body));
    },
  );
}
