import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_MANUAL_IMPORT, ANN_READ, asText } from "../clients/base.js";
import type { LidarrClient } from "../clients/lidarr.js";
import type { RadarrClient } from "../clients/radarr.js";
import type { ReadarrClient } from "../clients/readarr.js";
import type { SonarrClient } from "../clients/sonarr.js";

export type ManualImportApp = "radarr" | "sonarr" | "lidarr" | "readarr";
type ImportMode = "move" | "copy";
type Candidate = Record<string, unknown>;

interface ManualImportClient {
  manualImportCandidates(
    params: Record<string, string | number | boolean>,
  ): Promise<unknown>;
  triggerCommand(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
}

interface Locator {
  folder?: string;
  downloadId?: string;
  filterExistingFiles?: boolean;
  replaceExistingFiles?: boolean;
}

export type ManualImportTarget =
  | { app: "radarr"; movieId: number }
  | { app: "sonarr"; seriesId: number; episodeIds: number[] }
  | {
      app: "lidarr";
      artistId: number;
      albumId: number;
      albumReleaseId: number;
      trackIds: number[];
      disableReleaseSwitching: boolean;
    }
  | {
      app: "readarr";
      authorId: number;
      bookId: number;
      foreignEditionId: string;
      disableReleaseSwitching: boolean;
    };

function record(value: unknown, label: string): Candidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Candidate;
}

function requiredString(candidate: Candidate, key: string): string {
  const value = candidate[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Manual-import candidate is missing ${key}`);
  }
  return value;
}

function optionalString(candidate: Candidate, key: string): string | undefined {
  const value = candidate[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(candidate: Candidate, key: string): number | undefined {
  const value = candidate[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function candidateCommon(candidate: Candidate): Candidate {
  const quality = record(candidate.quality, "candidate quality");
  const result: Candidate = {
    path: requiredString(candidate, "path"),
    quality,
    indexerFlags: optionalNumber(candidate, "indexerFlags") ?? 0,
  };
  const folderName = optionalString(candidate, "folderName");
  const downloadId = optionalString(candidate, "downloadId");
  const releaseGroup = optionalString(candidate, "releaseGroup");
  if (folderName) result.folderName = folderName;
  if (downloadId) result.downloadId = downloadId;
  if (releaseGroup) result.releaseGroup = releaseGroup;
  if (Array.isArray(candidate.languages))
    result.languages = candidate.languages;
  return result;
}

export function buildManualImportQuery(
  locator: Locator,
  includeReplaceExisting = false,
): Record<string, string | number | boolean> {
  const folder = locator.folder?.trim();
  const downloadId = locator.downloadId?.trim();
  if (!folder && !downloadId) {
    throw new Error("Manual import requires folder or download_id");
  }
  const query: Record<string, string | number | boolean> = {
    filterExistingFiles: locator.filterExistingFiles ?? true,
  };
  if (folder) query.folder = folder;
  if (downloadId) query.downloadId = downloadId;
  if (includeReplaceExisting) {
    query.replaceExistingFiles = locator.replaceExistingFiles ?? false;
  }
  return query;
}

export function selectManualImportCandidate(
  value: unknown,
  path: string,
): Candidate {
  if (!Array.isArray(value)) {
    throw new Error(
      "Servarr returned a malformed manual-import candidate list",
    );
  }
  const matches = value
    .map((item) => record(item, "manual-import candidate"))
    .filter((candidate) => candidate.path === path);
  if (matches.length === 0) {
    throw new Error(
      `No current manual-import candidate exactly matches path "${path}"`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple current manual-import candidates match path "${path}"; refusing an ambiguous import`,
    );
  }
  return matches[0]!;
}

function selectedFields(value: unknown, fields: readonly string[]): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value ?? null;
  }
  const source = value as Candidate;
  return Object.fromEntries(
    fields
      .filter((field) => field in source)
      .map((field) => [field, source[field]]),
  );
}

export function compactManualImportCandidate(
  app: ManualImportApp,
  value: unknown,
): Candidate {
  const candidate = record(value, "manual-import candidate");
  const common: Candidate = {
    id: candidate.id ?? null,
    path: candidate.path ?? null,
    name: candidate.name ?? null,
    size: candidate.size ?? null,
    downloadId: candidate.downloadId ?? null,
    quality: candidate.quality ?? null,
    languages: candidate.languages ?? null,
    releaseGroup: candidate.releaseGroup ?? null,
    indexerFlags: candidate.indexerFlags ?? null,
    rejections: candidate.rejections ?? [],
  };
  if (app === "radarr") {
    common.movie = selectedFields(candidate.movie, [
      "id",
      "title",
      "year",
      "hasFile",
      "movieFileId",
      "movieFile",
    ]);
  } else if (app === "sonarr") {
    common.series = selectedFields(candidate.series, ["id", "title", "path"]);
    common.seasonNumber = candidate.seasonNumber ?? null;
    common.episodes = Array.isArray(candidate.episodes)
      ? candidate.episodes.map((episode) =>
          selectedFields(episode, [
            "id",
            "seasonNumber",
            "episodeNumber",
            "title",
            "hasFile",
            "episodeFileId",
            "episodeFile",
          ]),
        )
      : [];
    common.releaseType = candidate.releaseType ?? null;
  } else if (app === "lidarr") {
    common.artist = selectedFields(candidate.artist, [
      "id",
      "artistName",
      "path",
    ]);
    common.album = selectedFields(candidate.album, ["id", "title"]);
    common.albumReleaseId = candidate.albumReleaseId ?? null;
    common.tracks = Array.isArray(candidate.tracks)
      ? candidate.tracks.map((track) =>
          selectedFields(track, ["id", "title", "trackNumber", "hasFile"]),
        )
      : [];
  } else {
    common.author = selectedFields(candidate.author, [
      "id",
      "authorName",
      "path",
    ]);
    common.book = selectedFields(candidate.book, ["id", "title"]);
    common.foreignEditionId = candidate.foreignEditionId ?? null;
  }
  return common;
}

export function formatManualImportCandidates(
  app: ManualImportApp,
  value: unknown,
  options: { verbose?: boolean; limit?: number } = {},
): Candidate {
  if (!Array.isArray(value)) {
    throw new Error(
      "Servarr returned a malformed manual-import candidate list",
    );
  }
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error(
      "Manual-import candidate limit must be an integer from 1 to 100",
    );
  }
  const page = value.slice(0, limit);
  return {
    candidates: options.verbose
      ? page.map((item) => record(item, "manual-import candidate"))
      : page.map((item) => compactManualImportCandidate(app, item)),
    returned: page.length,
    total: value.length,
    truncated: value.length > page.length,
    mode: options.verbose ? "full" : "compact",
  };
}

export function buildManualImportFile(
  value: unknown,
  target: ManualImportTarget,
): Candidate {
  const candidate = record(value, "manual-import candidate");
  const common = candidateCommon(candidate);
  if (target.app === "radarr") {
    return { ...common, movieId: target.movieId };
  }
  if (target.app === "sonarr") {
    return {
      ...common,
      seriesId: target.seriesId,
      episodeIds: target.episodeIds,
      releaseType: candidate.releaseType,
    };
  }
  if (target.app === "lidarr") {
    return {
      ...common,
      artistId: target.artistId,
      albumId: target.albumId,
      albumReleaseId: target.albumReleaseId,
      trackIds: target.trackIds,
      disableReleaseSwitching: target.disableReleaseSwitching,
    };
  }
  return {
    path: common.path,
    quality: common.quality,
    indexerFlags: common.indexerFlags,
    downloadId: common.downloadId,
    authorId: target.authorId,
    bookId: target.bookId,
    foreignEditionId: target.foreignEditionId,
    disableReleaseSwitching: target.disableReleaseSwitching,
  };
}

async function candidateResponse(
  client: ManualImportClient,
  app: ManualImportApp,
  locator: Locator,
  options: { verbose?: boolean; limit?: number; includeReplace?: boolean },
): Promise<Candidate> {
  const value = await client.manualImportCandidates(
    buildManualImportQuery(locator, options.includeReplace),
  );
  return formatManualImportCandidates(app, value, options);
}

async function importCandidate(
  client: ManualImportClient,
  locator: Locator,
  path: string,
  target: ManualImportTarget,
  importMode: ImportMode,
  replaceExistingFiles?: boolean,
): Promise<unknown> {
  const value = await client.manualImportCandidates(
    buildManualImportQuery(
      { ...locator, filterExistingFiles: false, replaceExistingFiles },
      replaceExistingFiles !== undefined,
    ),
  );
  const candidate = selectManualImportCandidate(value, path);
  const args: Candidate = {
    files: [buildManualImportFile(candidate, target)],
    importMode,
  };
  if (replaceExistingFiles !== undefined) {
    args.replaceExistingFiles = replaceExistingFiles;
  }
  return client.triggerCommand("ManualImport", args);
}

function locatorSchema() {
  return {
    folder: z
      .string()
      .min(1)
      .optional()
      .describe("Folder visible to the Servarr app"),
    download_id: z
      .string()
      .min(1)
      .optional()
      .describe("Download-client id from the queue item"),
  };
}

function candidateOptionsSchema() {
  return {
    filter_existing_files: z
      .boolean()
      .optional()
      .describe("Exclude files already imported (default true)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum candidates returned (default 50, max 100)"),
    verbose: z
      .boolean()
      .optional()
      .describe(
        "Return full upstream candidate objects instead of the compact projection",
      ),
  };
}

function importControlSchema() {
  return {
    path: z
      .string()
      .min(1)
      .describe("Exact candidate path from the candidate-list tool"),
    import_mode: z
      .enum(["move", "copy"])
      .describe("Explicitly move the source file or copy it"),
    confirm: z
      .literal(true)
      .describe(
        "Must be exactly true to acknowledge file import and possible replacement",
      ),
  };
}

export function registerRadarrManualImportTools(
  server: McpServer,
  radarr: RadarrClient,
): void {
  server.registerTool(
    "radarr_manual_import_candidates",
    {
      title: "Radarr: Manual Import Candidates",
      description:
        "Discover files Radarr can manually import from a download id or folder. Compact and bounded by default; includes current movie/file context and rejections needed for a safe decision.",
      inputSchema: { ...locatorSchema(), ...candidateOptionsSchema() },
      annotations: ANN_READ,
    },
    async ({ folder, download_id, filter_existing_files, limit, verbose }) =>
      asText(
        await candidateResponse(
          radarr,
          "radarr",
          {
            folder,
            downloadId: download_id,
            filterExistingFiles: filter_existing_files,
          },
          { limit, verbose },
        ),
      ),
  );
  server.registerTool(
    "radarr_manual_import",
    {
      title: "Radarr: Manual Import",
      description:
        "Import one exact current candidate into an explicitly chosen movie. Re-fetches the candidate before queuing Radarr's real ManualImport command. Destructive: move mode removes the source and an upgrade may replace the existing movie file.",
      inputSchema: {
        ...locatorSchema(),
        ...importControlSchema(),
        movie_id: z
          .number()
          .int()
          .positive()
          .describe("Explicit destination Radarr movie id"),
      },
      annotations: ANN_MANUAL_IMPORT,
    },
    async ({ folder, download_id, path, movie_id, import_mode }) =>
      asText(
        await importCandidate(
          radarr,
          { folder, downloadId: download_id },
          path,
          { app: "radarr", movieId: movie_id },
          import_mode,
        ),
      ),
  );
}

export function registerSonarrManualImportTools(
  server: McpServer,
  sonarr: SonarrClient,
): void {
  server.registerTool(
    "sonarr_manual_import_candidates",
    {
      title: "Sonarr: Manual Import Candidates",
      description:
        "Discover files Sonarr can manually import from a download id or folder. Compact and bounded by default; includes mapped episodes, existing-file context, and rejections.",
      inputSchema: { ...locatorSchema(), ...candidateOptionsSchema() },
      annotations: ANN_READ,
    },
    async ({ folder, download_id, filter_existing_files, limit, verbose }) =>
      asText(
        await candidateResponse(
          sonarr,
          "sonarr",
          {
            folder,
            downloadId: download_id,
            filterExistingFiles: filter_existing_files,
          },
          { limit, verbose },
        ),
      ),
  );
  server.registerTool(
    "sonarr_manual_import",
    {
      title: "Sonarr: Manual Import",
      description:
        "Import one exact current candidate into an explicitly chosen series and episode set. Re-fetches the candidate before queuing Sonarr's real ManualImport command. Destructive: move mode removes the source and an upgrade may replace existing episode files.",
      inputSchema: {
        ...locatorSchema(),
        ...importControlSchema(),
        series_id: z
          .number()
          .int()
          .positive()
          .describe("Explicit destination Sonarr series id"),
        episode_ids: z
          .array(z.number().int().positive())
          .min(1)
          .describe("Explicit destination Sonarr episode ids"),
      },
      annotations: ANN_MANUAL_IMPORT,
    },
    async ({
      folder,
      download_id,
      path,
      series_id,
      episode_ids,
      import_mode,
    }) =>
      asText(
        await importCandidate(
          sonarr,
          { folder, downloadId: download_id },
          path,
          { app: "sonarr", seriesId: series_id, episodeIds: episode_ids },
          import_mode,
        ),
      ),
  );
}

export function registerLidarrManualImportTools(
  server: McpServer,
  lidarr: LidarrClient,
): void {
  server.registerTool(
    "lidarr_manual_import_candidates",
    {
      title: "Lidarr: Manual Import Candidates",
      description:
        "Discover files Lidarr can manually import from a download id or folder. Compact and bounded by default; replacement visibility is explicit.",
      inputSchema: {
        ...locatorSchema(),
        ...candidateOptionsSchema(),
        replace_existing_files: z
          .boolean()
          .optional()
          .describe(
            "Include candidates that would replace existing track files (default false)",
          ),
      },
      annotations: ANN_READ,
    },
    async ({
      folder,
      download_id,
      filter_existing_files,
      replace_existing_files,
      limit,
      verbose,
    }) =>
      asText(
        await candidateResponse(
          lidarr,
          "lidarr",
          {
            folder,
            downloadId: download_id,
            filterExistingFiles: filter_existing_files,
            replaceExistingFiles: replace_existing_files,
          },
          { limit, verbose, includeReplace: true },
        ),
      ),
  );
  server.registerTool(
    "lidarr_manual_import",
    {
      title: "Lidarr: Manual Import",
      description:
        "Import one exact current candidate with explicit artist, album, release, and track ids. Re-fetches before queuing the real ManualImport command. Destructive choices are mandatory, including whether existing files may be replaced.",
      inputSchema: {
        ...locatorSchema(),
        ...importControlSchema(),
        artist_id: z.number().int().positive(),
        album_id: z.number().int().positive(),
        album_release_id: z.number().int().positive(),
        track_ids: z.array(z.number().int().positive()).min(1),
        replace_existing_files: z
          .boolean()
          .describe(
            "Explicitly allow or forbid replacing existing track files",
          ),
        disable_release_switching: z
          .boolean()
          .optional()
          .describe(
            "Keep Lidarr from switching album releases (default false)",
          ),
      },
      annotations: ANN_MANUAL_IMPORT,
    },
    async ({
      folder,
      download_id,
      path,
      artist_id,
      album_id,
      album_release_id,
      track_ids,
      replace_existing_files,
      disable_release_switching = false,
      import_mode,
    }) =>
      asText(
        await importCandidate(
          lidarr,
          { folder, downloadId: download_id },
          path,
          {
            app: "lidarr",
            artistId: artist_id,
            albumId: album_id,
            albumReleaseId: album_release_id,
            trackIds: track_ids,
            disableReleaseSwitching: disable_release_switching,
          },
          import_mode,
          replace_existing_files,
        ),
      ),
  );
}

export function registerReadarrManualImportTools(
  server: McpServer,
  readarr: ReadarrClient,
): void {
  server.registerTool(
    "readarr_manual_import_candidates",
    {
      title: "Readarr: Manual Import Candidates",
      description:
        "Discover files Readarr can manually import from a download id or folder. Compact and bounded by default; replacement visibility is explicit.",
      inputSchema: {
        ...locatorSchema(),
        ...candidateOptionsSchema(),
        replace_existing_files: z
          .boolean()
          .optional()
          .describe(
            "Include candidates that would replace existing book files (default false)",
          ),
      },
      annotations: ANN_READ,
    },
    async ({
      folder,
      download_id,
      filter_existing_files,
      replace_existing_files,
      limit,
      verbose,
    }) =>
      asText(
        await candidateResponse(
          readarr,
          "readarr",
          {
            folder,
            downloadId: download_id,
            filterExistingFiles: filter_existing_files,
            replaceExistingFiles: replace_existing_files,
          },
          { limit, verbose, includeReplace: true },
        ),
      ),
  );
  server.registerTool(
    "readarr_manual_import",
    {
      title: "Readarr: Manual Import",
      description:
        "Import one exact current candidate with explicit author, book, and edition ids. Re-fetches before queuing the real ManualImport command. Destructive choices are mandatory, including whether existing files may be replaced.",
      inputSchema: {
        ...locatorSchema(),
        ...importControlSchema(),
        author_id: z.number().int().positive(),
        book_id: z.number().int().positive(),
        foreign_edition_id: z.string().min(1),
        replace_existing_files: z
          .boolean()
          .describe("Explicitly allow or forbid replacing existing book files"),
        disable_release_switching: z
          .boolean()
          .optional()
          .describe("Keep Readarr from switching editions (default false)"),
      },
      annotations: ANN_MANUAL_IMPORT,
    },
    async ({
      folder,
      download_id,
      path,
      author_id,
      book_id,
      foreign_edition_id,
      replace_existing_files,
      disable_release_switching = false,
      import_mode,
    }) =>
      asText(
        await importCandidate(
          readarr,
          { folder, downloadId: download_id },
          path,
          {
            app: "readarr",
            authorId: author_id,
            bookId: book_id,
            foreignEditionId: foreign_edition_id,
            disableReleaseSwitching: disable_release_switching,
          },
          import_mode,
          replace_existing_files,
        ),
      ),
  );
}
