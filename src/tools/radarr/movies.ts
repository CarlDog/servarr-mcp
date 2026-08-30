import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_ADD, ANN_EDIT, asText } from "../../clients/base.js";
import type { RadarrClient } from "../../clients/radarr.js";
import {
  applyServarrPathEdit,
  assertServarrPathEditApplied,
} from "../edit-path.js";

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
    "radarr_quick_add_movie",
    {
      title: "Radarr: Quick Add Movie",
      description:
        "Search for a movie by title and add it in one call, skipping the separate radarr_lookup_movie + radarr_add_movie round trip. " +
        "Only adds when the title search resolves to exactly one match — if the term returns multiple candidates, this tool refuses and lists them (title, year, tmdb_id) so you can either refine the search or call radarr_add_movie directly with the tmdb_id you want. Never guesses among ambiguous matches. " +
        "quality_profile_id and root_folder_path are optional: if omitted, this tool looks them up and auto-uses the value ONLY if exactly one is configured on this Radarr instance — with more than one configured, you must specify which to use (same refuse-and-list behavior). " +
        "Note: search_for_movie defaults to false here, same as radarr_add_movie — flip explicitly if you want an immediate indexer search.",
      inputSchema: {
        term: z
          .string()
          .describe(
            "Movie title to search for (same as radarr_lookup_movie's term).",
          ),
        quality_profile_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Quality profile id. Omit to auto-use the only configured profile; required if more than one exists.",
          ),
        root_folder_path: z
          .string()
          .optional()
          .describe(
            "Root folder path. Omit to auto-use the only configured root folder; required if more than one exists.",
          ),
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
      term,
      quality_profile_id,
      root_folder_path,
      monitored = true,
      search_for_movie = false,
    }) => {
      const candidates = (await radarr.lookupMovie(term)) as Array<
        Record<string, unknown>
      >;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        throw new Error(`Radarr lookup returned no results for "${term}".`);
      }
      if (candidates.length > 1) {
        const list = candidates
          .slice(0, 10)
          .map(
            (c) =>
              `  - ${c.title as string} (${c.year as number}) tmdb_id=${c.tmdbId as number}`,
          )
          .join("\n");
        throw new Error(
          `"${term}" matched ${candidates.length} movies — refusing to guess. Refine your search, or call radarr_add_movie directly with the tmdb_id you want:\n${list}`,
        );
      }
      const movie = candidates[0];

      let qualityProfileId = quality_profile_id;
      if (qualityProfileId === undefined) {
        const profiles = (await radarr.qualityProfiles()) as Array<{
          id: number;
          name: string;
        }>;
        if (profiles.length !== 1) {
          const list = profiles
            .map((p) => `  - id=${p.id} name="${p.name}"`)
            .join("\n");
          throw new Error(
            profiles.length === 0
              ? "No quality profiles are configured on this Radarr instance — configure one first."
              : `quality_profile_id is required: ${profiles.length} quality profiles are configured, so none can be auto-selected:\n${list}`,
          );
        }
        qualityProfileId = profiles[0]!.id;
      }

      let rootFolderPath = root_folder_path;
      if (rootFolderPath === undefined) {
        const folders = (await radarr.rootFolders()) as Array<{
          id: number;
          path: string;
        }>;
        if (folders.length !== 1) {
          const list = folders
            .map((f) => `  - id=${f.id} path="${f.path}"`)
            .join("\n");
          throw new Error(
            folders.length === 0
              ? "No root folders are configured on this Radarr instance — configure one first."
              : `root_folder_path is required: ${folders.length} root folders are configured, so none can be auto-selected:\n${list}`,
          );
        }
        rootFolderPath = folders[0]!.path;
      }

      const body = {
        ...movie,
        qualityProfileId,
        rootFolderPath,
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
        "Edit settings on an existing Radarr movie. Internally GETs the current MovieResource, applies your changes, and PUTs the full resource back. Pass only the fields you want to change — others are preserved. " +
        "root_folder_path rebases the movie's existing leaf folder under the new root and sends the derived full path explicitly; path overrides that derivation with an exact full on-disk folder path. The tool verifies the returned MovieResource reports the requested path instead of accepting a silent no-op. Either can trigger a file move — controlled by move_files, which this tool always passes explicitly and defaults to false, so a metadata-only correction with move_files left at its default never touches files on disk. Set move_files: true only when you intend an actual relocation.",
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
            "Change the root folder (from radarr_list_root_folders). The tool preserves the current leaf folder name, derives the full destination path under this root, and sends both fields. See move_files.",
          ),
        path: z
          .string()
          .optional()
          .describe(
            "Set the movie's exact full on-disk folder path instead of deriving it from root_folder_path. Use for metadata-only corrections (e.g. a case or mount-alias fix) — combine with the default move_files: false so Radarr updates its record without touching files.",
          ),
        move_files: z
          .boolean()
          .optional()
          .describe(
            "Whether a root_folder_path or path change should physically move files on disk. Defaults to false — always passed explicitly rather than relying on Radarr's own default. Set true only to perform an actual relocation.",
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
          .describe(
            "Replace the tag id list (from radarr_list_tags). Full replacement, not append.",
          ),
      },
      annotations: ANN_EDIT,
    },
    async ({
      id,
      monitored,
      quality_profile_id,
      root_folder_path,
      path,
      move_files,
      minimum_availability,
      tags,
    }) => {
      const current = (await radarr.getMovie(id)) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };
      if (monitored !== undefined) updated.monitored = monitored;
      if (quality_profile_id !== undefined) {
        updated.qualityProfileId = quality_profile_id;
      }
      const expectedPath = applyServarrPathEdit(updated, {
        rootFolderPath: root_folder_path,
        path,
        resourceName: "Radarr movie",
      });
      if (minimum_availability !== undefined) {
        updated.minimumAvailability = minimum_availability;
      }
      if (tags !== undefined) updated.tags = tags;
      const result = await radarr.editMovie(id, updated, move_files ?? false);
      assertServarrPathEditApplied(result, expectedPath, "Radarr movie");
      return asText(result);
    },
  );
}
