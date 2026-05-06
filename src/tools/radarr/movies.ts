import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_ADD, ANN_EDIT, asText } from "../../clients/base.js";
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
          .describe(
            "The TMDB id of the movie to add (from radarr_lookup_movie).",
          ),
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
      annotations: ANN_ADD,
    },
    async ({
      tmdb_id,
      quality_profile_id,
      root_folder_path,
      monitored = true,
      search_for_movie = false,
    }) => {
      const lookup = (await radarr.lookupMovie(`tmdb:${tmdb_id}`)) as Array<
        Record<string, unknown>
      >;
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

  server.registerTool(
    "radarr_edit_movie",
    {
      title: "Radarr: Edit Movie",
      description:
        "Edit settings on an existing Radarr movie. Internally GETs the current MovieResource, applies your changes, and PUTs the full resource back. Pass only the fields you want to change — others are preserved. WARNING: changing root_folder_path moves files on disk.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("The Radarr movie id (from radarr_list_movies)."),
        monitored: z
          .boolean()
          .optional()
          .describe(
            "Toggle whether Radarr tracks this movie for upgrades/grabs.",
          ),
        quality_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Change the quality profile (from radarr_list_quality_profiles).",
          ),
        root_folder_path: z
          .string()
          .optional()
          .describe(
            "Change the root folder. WARNING: this moves the movie files on disk.",
          ),
        minimum_availability: z
          .enum(["tba", "announced", "inCinemas", "released", "preDB"])
          .optional()
          .describe(
            "When to consider the movie 'available' (Radarr-specific).",
          ),
        tags: z
          .array(z.number().int())
          .optional()
          .describe("Replace the tag id list (full list, not append)."),
      },
      annotations: ANN_EDIT,
    },
    async ({
      id,
      monitored,
      quality_profile_id,
      root_folder_path,
      minimum_availability,
      tags,
    }) => {
      const current = (await radarr.getMovie(id)) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };
      if (monitored !== undefined) updated.monitored = monitored;
      if (quality_profile_id !== undefined) {
        updated.qualityProfileId = quality_profile_id;
      }
      if (root_folder_path !== undefined) {
        updated.rootFolderPath = root_folder_path;
      }
      if (minimum_availability !== undefined) {
        updated.minimumAvailability = minimum_availability;
      }
      if (tags !== undefined) updated.tags = tags;
      return asText(await radarr.editMovie(id, updated));
    },
  );
}
