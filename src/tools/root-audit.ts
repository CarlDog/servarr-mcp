import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_READ, asText } from "../clients/base.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginate } from "./_paging.js";

type RootAuditClient = {
  rootFolders(): Promise<unknown>;
};

type RootAuditConfig<TClient extends RootAuditClient> = {
  prefix: string;
  appName: string;
  entityName: string;
  listEntities(client: TClient): Promise<unknown>;
};

type RootReferenceMatch = "exact" | "case_only" | "unconfigured" | "missing";

type PathRelation = "exact" | "case_only" | "outside" | "missing";

export type RootAuditRecord = {
  id: number | null;
  path: string | null;
  referenced_root: string | null;
  configured_root: string | null;
  reference_source: "resource" | "inferred_from_path" | "missing";
  reference_match: RootReferenceMatch;
  path_relation: PathRelation;
  has_issue: boolean;
};

export type RootAuditResult = {
  summary: {
    configured_root_count: number;
    library_record_count: number;
    ok_count: number;
    issue_count: number;
    exact_reference_count: number;
    case_only_reference_count: number;
    unconfigured_reference_count: number;
    missing_reference_count: number;
    exact_path_count: number;
    case_only_path_count: number;
    outside_path_count: number;
    missing_path_count: number;
  };
  records: RootAuditRecord[];
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeRoot(path: string): string {
  if (path === "/" || path === "\\" || /^[A-Za-z]:[\\/]$/.test(path)) {
    return path;
  }
  return path.replace(/[\\/]+$/, "");
}

function equalsPath(a: string, b: string, ignoreCase: boolean): boolean {
  return ignoreCase
    ? a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0
    : a === b;
}

function isAtOrUnder(path: string, root: string, ignoreCase: boolean): boolean {
  if (equalsPath(path, root, ignoreCase)) return true;

  const candidate = ignoreCase ? path.toLocaleLowerCase() : path;
  const prefix = ignoreCase ? root.toLocaleLowerCase() : root;
  if (!candidate.startsWith(prefix)) return false;
  if (/[\\/]$/.test(prefix)) return true;

  const boundary = candidate.charAt(prefix.length);
  return boundary === "/" || boundary === "\\";
}

function configuredMatch(
  referencedRoot: string,
  configuredRoots: string[],
): { match: RootReferenceMatch; root: string | null } {
  const exact = configuredRoots.find((root) => root === referencedRoot);
  if (exact !== undefined) return { match: "exact", root: exact };

  const caseOnly = configuredRoots.find((root) =>
    equalsPath(root, referencedRoot, true),
  );
  if (caseOnly !== undefined) return { match: "case_only", root: caseOnly };

  return { match: "unconfigured", root: null };
}

function inferRoot(
  itemPath: string,
  configuredRoots: string[],
): { root: string; configured: string; match: "exact" | "case_only" } | null {
  const byLength = [...configuredRoots].sort((a, b) => b.length - a.length);
  const exact = byLength.find((root) => isAtOrUnder(itemPath, root, false));
  if (exact !== undefined) {
    return { root: exact, configured: exact, match: "exact" };
  }

  const caseOnly = byLength.find((root) => isAtOrUnder(itemPath, root, true));
  if (caseOnly === undefined) return null;
  return {
    root: itemPath.slice(0, caseOnly.length),
    configured: caseOnly,
    match: "case_only",
  };
}

function relationToRoot(
  itemPath: string | null,
  referencedRoot: string | null,
): PathRelation {
  if (itemPath === null || referencedRoot === null) return "missing";
  if (isAtOrUnder(itemPath, referencedRoot, false)) return "exact";
  if (isAtOrUnder(itemPath, referencedRoot, true)) return "case_only";
  return "outside";
}

function asRecords(
  value: unknown,
  label: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${label} returned a non-array response`);
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

export function auditReferencedRoots(
  rootFolders: unknown,
  entities: unknown,
): RootAuditResult {
  const configuredRoots = asRecords(rootFolders, "Root-folder endpoint")
    .map((root) => nonEmptyString(root.path))
    .filter((path): path is string => path !== null)
    .map(normalizeRoot);
  const library = asRecords(entities, "Library endpoint");

  const records = library.map((entity): RootAuditRecord => {
    const id =
      typeof entity.id === "number" && Number.isInteger(entity.id)
        ? entity.id
        : null;
    const path = nonEmptyString(entity.path);
    const resourceRoot = nonEmptyString(entity.rootFolderPath);

    let referencedRoot: string | null = null;
    let configuredRoot: string | null = null;
    let referenceSource: RootAuditRecord["reference_source"] = "missing";
    let referenceMatch: RootReferenceMatch = "missing";

    if (resourceRoot !== null) {
      referencedRoot = normalizeRoot(resourceRoot);
      referenceSource = "resource";
      const configured = configuredMatch(referencedRoot, configuredRoots);
      configuredRoot = configured.root;
      referenceMatch = configured.match;
    } else if (path !== null) {
      const inferred = inferRoot(path, configuredRoots);
      if (inferred !== null) {
        referencedRoot = inferred.root;
        configuredRoot = inferred.configured;
        referenceSource = "inferred_from_path";
        referenceMatch = inferred.match;
      }
    }

    const pathRelation = relationToRoot(path, referencedRoot);
    const hasIssue = referenceMatch !== "exact" || pathRelation !== "exact";

    return {
      id,
      path,
      referenced_root: referencedRoot,
      configured_root: configuredRoot,
      reference_source: referenceSource,
      reference_match: referenceMatch,
      path_relation: pathRelation,
      has_issue: hasIssue,
    };
  });

  const count = <T extends string>(
    key: "reference_match" | "path_relation",
    value: T,
  ): number => records.filter((record) => record[key] === value).length;

  return {
    summary: {
      configured_root_count: configuredRoots.length,
      library_record_count: records.length,
      ok_count: records.filter((record) => !record.has_issue).length,
      issue_count: records.filter((record) => record.has_issue).length,
      exact_reference_count: count("reference_match", "exact"),
      case_only_reference_count: count("reference_match", "case_only"),
      unconfigured_reference_count: count("reference_match", "unconfigured"),
      missing_reference_count: count("reference_match", "missing"),
      exact_path_count: count("path_relation", "exact"),
      case_only_path_count: count("path_relation", "case_only"),
      outside_path_count: count("path_relation", "outside"),
      missing_path_count: count("path_relation", "missing"),
    },
    records,
  };
}

export function registerRootAuditTool<TClient extends RootAuditClient>(
  server: McpServer,
  client: TClient,
  config: RootAuditConfig<TClient>,
): void {
  server.registerTool(
    `${config.prefix}_audit_referenced_roots`,
    {
      title: `${config.appName}: Audit Referenced Roots`,
      description:
        `Compare every tracked ${config.entityName} path/rootFolderPath with the roots currently configured in ${config.appName}. ` +
        "Classifies exact matches, case-only mismatches, references to roots that are no longer configured, missing references, and item paths outside their reported root. " +
        "Returns issue records only by default; set include_matches=true to page through the full audit. The upstream library endpoint is still an all-record fetch, so output paging limits response size rather than upstream load.",
      inputSchema: {
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Page number, 1-indexed (default 1)."),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .optional()
          .describe(
            `Records per page (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}).`,
          ),
        include_matches: z
          .boolean()
          .optional()
          .describe(
            "Include healthy exact-match records as well as issues. Default false.",
          ),
      },
      annotations: ANN_READ,
    },
    async ({
      page = 1,
      page_size = DEFAULT_PAGE_SIZE,
      include_matches = false,
    }) => {
      const [rootFolders, entities] = await Promise.all([
        client.rootFolders(),
        config.listEntities(client),
      ]);
      const audit = auditReferencedRoots(rootFolders, entities);
      const selected = include_matches
        ? audit.records
        : audit.records.filter((record) => record.has_issue);
      return asText({
        summary: audit.summary,
        includes_healthy_matches: include_matches,
        ...paginate(selected, page, page_size),
      });
    },
  );
}
