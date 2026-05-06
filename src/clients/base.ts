export interface ServarrConfig {
  url: string;
  apiKey: string;
  apiPath: string;
  appName: string;
}

export class ServarrClient {
  constructor(protected readonly config: ServarrConfig) {}

  protected async request<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    const url = new URL(this.config.apiPath + path, this.config.url);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": this.config.apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `${this.config.appName} ${res.status} ${res.statusText} for ${path}: ${body.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  protected async requestPost<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(this.config.apiPath + path, this.config.url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${this.config.appName} ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  protected async requestPut<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(this.config.apiPath + path, this.config.url);
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${this.config.appName} ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  protected async requestPostVoid(path: string, body: unknown): Promise<void> {
    const url = new URL(this.config.apiPath + path, this.config.url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${this.config.appName} ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 200)}`,
      );
    }
    // Servarr POSTs that mutate without returning a body (e.g.
    // /history/failed/{id}). We deliberately don't parse the response.
  }

  protected async requestDelete(
    path: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    const url = new URL(this.config.apiPath + path, this.config.url);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Api-Key": this.config.apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${this.config.appName} ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 200)}`,
      );
    }
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

  async queue(): Promise<unknown> {
    return this.request("/queue");
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
}

export const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

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
