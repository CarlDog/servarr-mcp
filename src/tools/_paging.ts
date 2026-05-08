// Server-side paging + field projection for *arr list endpoints whose
// upstream GETs return the entire library at once. Radarr, Sonarr,
// Lidarr all expose `/movie`, `/series`, `/artist`, `/album` as
// "return everything" endpoints with no upstream paging — so we fetch
// the full array, project to slim fields by default, and slice in the
// tool handler before returning. Keeps tool results under the MCP
// response cap on large libraries.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type PagedResult<T> = {
  page: number;
  page_size: number;
  total_records: number;
  records: T[];
};

export function paginate<T>(
  items: T[],
  page = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PagedResult<T> {
  const start = (page - 1) * pageSize;
  return {
    page,
    page_size: pageSize,
    total_records: items.length,
    records: items.slice(start, start + pageSize),
  };
}

export function pickFields<K extends string>(
  obj: Record<string, unknown>,
  keys: readonly K[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}
