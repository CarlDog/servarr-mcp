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

  async history(pageSize = 20): Promise<unknown> {
    return this.request("/history", {
      pageSize,
      sortKey: "date",
      sortDirection: "descending",
    });
  }

  async wantedMissing(pageSize = 20, monitored = true): Promise<unknown> {
    return this.request("/wanted/missing", { pageSize, monitored });
  }

  async wantedCutoff(pageSize = 20, monitored = true): Promise<unknown> {
    return this.request("/wanted/cutoff", { pageSize, monitored });
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
