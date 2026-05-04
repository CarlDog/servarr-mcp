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

  async rootFolders(): Promise<unknown> {
    return this.request("/rootfolder");
  }

  async queue(): Promise<unknown> {
    return this.request("/queue");
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
