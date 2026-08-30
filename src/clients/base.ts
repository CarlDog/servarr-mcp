import {
  ApiError,
  backoffMs,
  describeTransportError,
  formatApiError,
  parseRetryAfterMs,
  shouldRetry,
} from "../shared/errors.js";
import { logger } from "../shared/log.js";

export interface ServarrConfig {
  url: string;
  apiKey: string;
  apiPath: string;
  appName: string;
}

// MCP-F01: every outbound request is bounded by a timeout so a hung *arr
// instance blocks a tool call for seconds, not forever.
const TIMEOUT_MS = 30_000;

// MCP-F02: bound how many times a GET is retried on a transient upstream
// failure. Writes (POST/PUT/DELETE) never retry — see requestOnce below.
const MAX_RETRIES = 3;

const log = logger("servarr-client");

export class ServarrClient {
  constructor(protected readonly config: ServarrConfig) {}

  private buildUrl(
    path: string,
    params: Record<
      string,
      string | number | boolean | readonly (string | number)[]
    > = {},
  ): URL {
    const url = new URL(this.config.apiPath + path, this.config.url);
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        // Repeated keys (?k=1&k=2) — required by ASP.NET Core's default
        // List<int> query binding; a comma-joined single value fails to
        // parse and the filter is silently ignored server-side.
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    return url;
  }

  // The single outbound chokepoint every request method funnels through
  // (security.md: a cross-cutting transform — here, timeout + typed errors —
  // only protects the calls that pass through it). Applies a fresh
  // AbortController per call, reads the body while the timeout is still
  // armed (a response that streams slowly enough to hang forever would
  // otherwise slip past it), and converts both transport failures and
  // non-ok responses into a typed ApiError. Never retries itself — retry is
  // the caller's decision (GET only, see `request` below).
  private async requestOnce(
    path: string,
    url: URL,
    init: RequestInit,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
        throw new ApiError(
          formatApiError(
            this.config.appName,
            res.status,
            res.statusText,
            path,
            text,
          ),
          { status: res.status, retryAfterMs, body: text },
        );
      }
      return text;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiError(
          `${this.config.appName} request to ${path} timed out after ${TIMEOUT_MS}ms`,
          { status: 0 },
        );
      }
      throw new ApiError(
        `${this.config.appName} network error for ${path}: ${describeTransportError(err)}`,
        { status: 0 },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  protected async request<T>(
    path: string,
    params: Record<
      string,
      string | number | boolean | readonly (string | number)[]
    > = {},
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const init: RequestInit = {
      headers: {
        "X-Api-Key": this.config.apiKey,
        Accept: "application/json",
      },
    };
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const text = await this.requestOnce(path, url, init);
        return JSON.parse(text) as T;
      } catch (err) {
        lastErr = err;
        // GET is idempotent, so a 429 or transient transport/5xx failure is
        // safe to retry — POST/PUT/DELETE are not (see below), matching
        // MCP-F02's "idempotent-only retry".
        if (attempt < MAX_RETRIES && shouldRetry(err, true)) {
          const wait =
            (err instanceof ApiError && err.retryAfterMs) || backoffMs(attempt);
          log.warn("retrying after upstream failure", {
            path,
            attempt: attempt + 1,
            waitMs: wait,
          });
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  protected async requestPost<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const text = await this.requestOnce(path, url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return JSON.parse(text) as T;
  }

  protected async requestPut<T>(
    path: string,
    body: unknown,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const text = await this.requestOnce(path, url, {
      method: "PUT",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return JSON.parse(text) as T;
  }

  protected async requestPostVoid(path: string, body: unknown): Promise<void> {
    const url = this.buildUrl(path);
    await this.requestOnce(path, url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    // Servarr POSTs that mutate without returning a body (e.g.
    // /history/failed/{id}). We deliberately don't parse the response.
  }

  protected async requestDelete(
    path: string,
    params: Record<string, string | number | boolean> = {},
    body?: unknown,
  ): Promise<void> {
    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = {
      "X-Api-Key": this.config.apiKey,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    await this.requestOnce(path, url, {
      method: "DELETE",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Servarr DELETE endpoints typically return 200/204 with no body.
  }

  async systemStatus(): Promise<unknown> {
    return this.request("/system/status");
  }

  async health(): Promise<unknown> {
    return this.request("/health");
  }

  async diskspace(): Promise<unknown> {
    return this.request("/diskspace");
  }

  async qualityProfiles(): Promise<unknown> {
    return this.request("/qualityprofile");
  }

  async metadataProfiles(): Promise<unknown> {
    return this.request("/metadataprofile");
  }

  async rootFolders(): Promise<unknown> {
    return this.request("/rootfolder");
  }

  async tags(): Promise<unknown> {
    return this.request("/tag");
  }

  async importLists(): Promise<unknown> {
    return this.request("/importlist");
  }

  async importList(id: number): Promise<unknown> {
    return this.request(`/importlist/${id}`);
  }

  async updateImportList(
    id: number,
    resource: Record<string, unknown>,
  ): Promise<unknown> {
    return this.requestPut(`/importlist/${id}`, resource);
  }

  async notifications(): Promise<unknown> {
    return this.request("/notification");
  }

  async notification(id: number): Promise<unknown> {
    return this.request(`/notification/${id}`);
  }

  async updateNotification(
    id: number,
    resource: Record<string, unknown>,
  ): Promise<unknown> {
    return this.requestPut(`/notification/${id}`, resource);
  }

  async queue(page = 1, pageSize = 20): Promise<unknown> {
    return this.request("/queue", { page, pageSize });
  }

  async queueRemove(
    id: number,
    opts: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
  ): Promise<void> {
    const params: Record<string, boolean> = {};
    if (opts.removeFromClient !== undefined) {
      params.removeFromClient = opts.removeFromClient;
    }
    if (opts.blocklist !== undefined) params.blocklist = opts.blocklist;
    if (opts.skipRedownload !== undefined) {
      params.skipRedownload = opts.skipRedownload;
    }
    if (opts.changeCategory !== undefined) {
      params.changeCategory = opts.changeCategory;
    }
    await this.requestDelete(`/queue/${id}`, params);
  }

  async queueRemoveBulk(
    ids: number[],
    opts: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
  ): Promise<void> {
    const params: Record<string, boolean> = {};
    if (opts.removeFromClient !== undefined) {
      params.removeFromClient = opts.removeFromClient;
    }
    if (opts.blocklist !== undefined) params.blocklist = opts.blocklist;
    if (opts.skipRedownload !== undefined) {
      params.skipRedownload = opts.skipRedownload;
    }
    if (opts.changeCategory !== undefined) {
      params.changeCategory = opts.changeCategory;
    }
    await this.requestDelete("/queue/bulk", params, { ids });
  }

  async queueRegrab(id: number): Promise<unknown> {
    return this.requestPost(`/queue/grab/${id}`, {});
  }

  async history(pageSize = 20): Promise<unknown> {
    return this.request("/history", {
      pageSize,
      sortKey: "date",
      sortDirection: "descending",
    });
  }

  async markHistoryFailed(id: number): Promise<void> {
    await this.requestPostVoid(`/history/failed/${id}`, {});
  }

  async wantedMissing(pageSize = 20, monitored = true): Promise<unknown> {
    return this.request("/wanted/missing", { pageSize, monitored });
  }

  async wantedCutoff(pageSize = 20, monitored = true): Promise<unknown> {
    return this.request("/wanted/cutoff", { pageSize, monitored });
  }

  // GET /release with the per-app id filters (seriesId/episodeId/
  // seasonNumber for Sonarr, movieId for Radarr, etc.). Triggers a
  // live indexer search server-side and returns ReleaseResource[].
  // Callers must pass at least one scoping id; an unscoped call hits
  // every indexer with no filter, which we refuse at the tool layer.
  async searchReleases(
    params: Record<string, number | undefined>,
  ): Promise<unknown> {
    const filtered: Record<string, number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) filtered[k] = v;
    }
    return this.request("/release", filtered);
  }

  // POST /release. Body is a ReleaseResource — Servarr looks the
  // release up in its in-memory cache by guid+indexerId, so the
  // caller is expected to pass the object verbatim from
  // searchReleases output. Cache TTL is a few minutes; if it expired
  // the server returns an error and the caller must re-search.
  async grabRelease(body: Record<string, unknown>): Promise<unknown> {
    return this.requestPost("/release", body);
  }

  // Queue an async command. Returns the CommandResource immediately
  // (id, status: "queued"); the work happens in the background. Tools
  // should NOT poll synchronously — see SERVARR-API.md § Commands.
  async triggerCommand(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.requestPost("/command", { name, ...args });
  }

  // Companion poll for triggerCommand. Returns the current
  // CommandResource: status ("queued" / "started" / "completed" /
  // "failed"), exception, started/ended timestamps, etc. The id comes
  // from the triggerCommand response.
  async getCommand(id: number): Promise<unknown> {
    return this.request(`/command/${id}`);
  }
}

// Servarr-team APIs (indexers, download clients, notifications, import
// lists — anywhere a provider is configured via a Field[] schema) mark
// sensitive fields with a `privacy` discriminator: "normal" | "password" |
// "apiKey" | "userName". A Field object carrying one of the three
// non-normal levels holds the actual secret in its `value` — e.g.
// prowlarr_list_indexers returns each indexer's raw apiKey/passkey/RSS
// key verbatim today. This walks the whole response tree (not just
// Prowlarr) so any current or future tool returning Field-shaped data is
// covered by the same chokepoint, per security.md's "route every
// security-critical transform through a single chokepoint" — asText is
// the one place every tool response passes through before it reaches the
// model's context.
const SENSITIVE_PRIVACY_LEVELS = new Set(["password", "apiKey", "userName"]);
const REDACTED = "[redacted]";

// Second, independent leak class: history/queue records carry provider
// fetch URLs (data.downloadUrl, nzbInfoUrl, guid, infoUrl, ...) that embed
// an *upstream indexer's* API key as a query param when the indexer is
// Prowlarr-fronted — e.g. `http://prowlarr:9696/8/download?apikey=<key>&...`.
// Confirmed live on sonarr_history and radarr_history_movie: reading one
// app's history hands you a different app's credential. The Field-privacy
// walk above doesn't cover this — these are plain strings, not
// {value, privacy} objects — so every string in the tree gets checked here
// too, rather than hardcoding the field names above (a future field
// carrying the same shape is covered automatically).
const SENSITIVE_QUERY_PARAM_NAMES = new Set([
  "apikey",
  "api_key",
  "passkey",
  "pass_key",
]);
// Cheap pre-filter so most strings (titles, paths, plain URLs) skip the
// URL-parsing attempt entirely.
const LOOKS_LIKE_SENSITIVE_QUERY = /[?&](apikey|api_key|passkey|pass_key)=/i;

function redactUrlSecrets(value: string): string {
  if (!LOOKS_LIKE_SENSITIVE_QUERY.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value; // not an absolute URL — nothing safe to do
  }
  let changed = false;
  // Snapshot keys before mutating — .set() collapses duplicate-named
  // params, which would resize the live searchParams mid-iteration.
  for (const key of Array.from(url.searchParams.keys())) {
    if (SENSITIVE_QUERY_PARAM_NAMES.has(key.toLowerCase())) {
      url.searchParams.set(key, REDACTED);
      changed = true;
    }
  }
  return changed ? url.toString() : value;
}

function redactSensitiveFields(value: unknown): unknown {
  if (typeof value === "string") {
    return redactUrlSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (
      "value" in obj &&
      typeof obj.privacy === "string" &&
      SENSITIVE_PRIVACY_LEVELS.has(obj.privacy)
    ) {
      return { ...obj, value: REDACTED };
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = redactSensitiveFields(v);
    }
    return result;
  }
  return value;
}

export const asText = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(redactSensitiveFields(data), null, 2),
    },
  ],
});

// MCP annotation bundles. Each tool registration passes one of these
// in its config so clients can filter (read-only vs write), apply
// safety prompts (destructiveHint), and reason about retry behavior
// (idempotentHint) without parsing prose. openWorldHint is true when
// the tool reaches beyond the configured *arr instance — TMDB/TVDB/
// MusicBrainz/Goodreads metadata fetches, indexer searches, or
// download-client interactions.

// Read-only against the *arr instance only. No external fanout.
export const ANN_READ = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

// Read against an external metadata source (TMDB / TVDB / MusicBrainz /
// Goodreads) or live indexer query. Same readOnlyHint, but flagged
// open-world so clients know the tool can be slow or rate-limited.
export const ANN_READ_EXT = {
  readOnlyHint: true,
  openWorldHint: true,
} as const;

// Add a new tracked entity (add_series / add_movie / add_artist /
// add_author). Not destructive (additive only); not idempotent
// (duplicate-add errors).
export const ANN_ADD = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// Edit an existing tracked entity. Idempotent (re-applying same edit
// is a no-op); destructive flag is true because root-folder changes
// move files on disk.
export const ANN_EDIT = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Async command trigger (search_missing, search_<resource>, refresh_*).
// Idempotent at the command-queue level; the actual indexer/metadata
// fanout makes this open-world.
export const ANN_COMMAND = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// Grab a release — queues a download via the download client. Additive
// (not destructive), but not idempotent (re-grab spawns another
// download).
export const ANN_GRAB = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

// Remove an item from the download queue. Can delete the file from the
// download client (removeFromClient flag), so destructive. Removing an
// already-removed item is a no-op → idempotent.
export const ANN_QUEUE_REMOVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// Manual import moves/copies a downloaded file into the library and may
// replace an existing media file. Repeating it is not safely idempotent.
export const ANN_MANUAL_IMPORT = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

// Targeted provider-configuration updates. Re-applying the same state is a
// no-op, but disabling an import list or notification event changes automation
// behavior, so clients should treat it as a consequential destructive edit.
export const ANN_CONFIG_EDIT = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Force re-grab of a stuck queue item. Each call spawns a fresh grab,
// so not idempotent.
export const ANN_QUEUE_REGRAB = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

// Mark a history record failed. Triggers downstream re-search +
// potential file replacement → flagged destructive. Already-failed
// items stay failed → idempotent.
export const ANN_MARK_FAILED = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// Run `fn` while emitting MCP progress notifications on a timer, so the
// caller can show liveness during a long-running upstream call. If the
// MCP client didn't pass a progressToken in the original request,
// notifications are skipped — there's no token to address them to.
//
// `extra` matches the relevant subset of the SDK's RequestHandlerExtra;
// it's parameterized over the notification type so call sites can pass
// the SDK's strict ServerNotification signature without coercion.
export async function withProgress<T, N>(
  extra: {
    _meta?: { progressToken?: string | number };
    sendNotification: (notification: N) => Promise<void>;
  },
  mkMessage: (elapsedSeconds: number) => string,
  intervalMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const token = extra._meta?.progressToken;
  if (token === undefined) return fn();

  const start = Date.now();
  const timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    void extra
      .sendNotification({
        method: "notifications/progress",
        params: {
          progressToken: token,
          progress: elapsed,
          message: mkMessage(elapsed),
        },
      } as N)
      .catch(() => undefined);
  }, intervalMs);

  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}
