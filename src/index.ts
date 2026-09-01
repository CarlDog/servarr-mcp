#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { type Request, type Response } from "express";
import { LidarrClient } from "./clients/lidarr.js";
import { ProwlarrClient } from "./clients/prowlarr.js";
import { RadarrClient } from "./clients/radarr.js";
import { ReadarrClient } from "./clients/readarr.js";
import { SonarrClient } from "./clients/sonarr.js";
import { mountMcpHttp } from "./shared/http-transport.js";
import { SERVER_VERSION } from "./shared/version.js";
import { planStartup, type AppRegistration } from "./startup.js";
import { registerLidarrTools } from "./tools/lidarr/index.js";
import { registerProwlarrTools } from "./tools/prowlarr/index.js";
import { registerRadarrTools } from "./tools/radarr/index.js";
import { registerReadarrTools } from "./tools/readarr/index.js";
import { registerSonarrTools } from "./tools/sonarr/index.js";

const apps: AppRegistration[] = [
  {
    name: "Sonarr",
    envPrefix: "SONARR",
    register: (s, u, k) => registerSonarrTools(s, new SonarrClient(u, k)),
  },
  {
    name: "Radarr",
    envPrefix: "RADARR",
    register: (s, u, k) => registerRadarrTools(s, new RadarrClient(u, k)),
  },
  {
    name: "Lidarr",
    envPrefix: "LIDARR",
    register: (s, u, k) => registerLidarrTools(s, new LidarrClient(u, k)),
  },
  {
    name: "Readarr",
    envPrefix: "READARR",
    register: (s, u, k) => registerReadarrTools(s, new ReadarrClient(u, k)),
  },
  {
    name: "Prowlarr",
    envPrefix: "PROWLARR",
    register: (s, u, k) => registerProwlarrTools(s, new ProwlarrClient(u, k)),
  },
];

const portStr = process.env.MCP_PORT;
const port = portStr ? Number.parseInt(portStr, 10) : null;
if (portStr && (port === null || Number.isNaN(port))) {
  console.error(`Invalid MCP_PORT: ${portStr}`);
  process.exit(1);
}

const { enabled: enabledApps, warnings } = planStartup(process.env, apps);
for (const warning of warnings) {
  console.error(`WARNING: ${warning}`);
}

if (enabledApps.length === 0) {
  console.error(
    "No Servarr apps configured. Set <APP>_URL and <APP>_API_KEY for at least one of:",
  );
  console.error("  " + apps.map((a) => a.envPrefix).join(", "));
  // Exiting under `restart: unless-stopped` turns one bad env var into a
  // crash loop with nothing to query. In HTTP mode stay up so /health still
  // answers and reports `enabled: []`; stdio has no client to serve.
  if (!port) process.exit(1);
  console.error(
    "Staying up so /health remains queryable; no tools are registered until the configuration is fixed.",
  );
}

const INSTRUCTIONS = `MCP server for the Servarr stack: Sonarr (TV), Radarr (movies), Lidarr (music), Readarr (books), Prowlarr (indexer manager). Each app is optional — only the apps with both URL and API key configured will have their tools registered. Exposes both reads and writes: alongside the browse/search tools, each media app registers add/edit for tracked entities, queue management (remove / force re-grab), interactive release search + grab, history mark-failed, and async search/refresh command triggers. Prowlarr is read-only. Every tool carries MCP annotations (readOnlyHint / destructiveHint / idempotentHint) — filter on those to distinguish reads from writes.

Idioms:
- Write tools change server state (and grabs queue real downloads). Confirm with the user before invoking a write tool unless intent is unambiguous.
- Tools are namespaced by app: sonarr_*, radarr_*, lidarr_*, readarr_*, prowlarr_*. The visible tool set tells you which apps are configured — not which are reachable, since there is no startup connectivity check. A configured-but-down app still registers its tools and fails at call time.
- Two flavors of "find": *_list_* returns items already tracked by the app (the user's library); *_lookup_* searches the upstream metadata source (TVDB / TMDB / etc.) for items not yet added — useful for "do I already have X?" vs "could I add X?".
- *_calendar shows upcoming releases for tracked items; only Sonarr and Radarr expose it (Lidarr / Readarr / Prowlarr don't).
- prowlarr_search hits the indexers directly — heavier than the per-app *_lookup_* tools, use only when the user wants raw release results outside the *arr metadata flow.

Auth: per-app API keys via env vars (SONARR_API_KEY, RADARR_API_KEY, etc.). The server registers an app only when both URL and key are set.`;

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "servarr-mcp",
      version: SERVER_VERSION,
    },
    {
      instructions: INSTRUCTIONS,
    },
  );
  for (const app of enabledApps) {
    app.register(server, app.url, app.apiKey);
  }
  return server;
}

console.error(
  `servarr-mcp: enabled = ${enabledApps.map((a) => a.name).join(", ") || "(none)"}`,
);

if (port) {
  // HTTP transport (long-lived server, e.g. for Portainer/Compose deployment).
  //
  // Auth + Host/Origin allowlist + idle-session eviction are optional but
  // strongly recommended — see MCP_AUTH_TOKEN / MCP_ALLOWED_HOSTS below.
  // Binding loopback would NOT be a substitute for these: the container's
  // loopback is its own, so the server binds 0.0.0.0 to be reachable at all,
  // and a browser on the host can still reach it via DNS rebinding. See
  // shared/http-transport.ts and reference/rules/docker-deployments.md §8.
  const authToken = process.env.MCP_AUTH_TOKEN || undefined;
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS
    ? process.env.MCP_ALLOWED_HOSTS.split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : undefined;
  const sessionIdleMs = process.env.MCP_SESSION_IDLE_MS
    ? Number.parseInt(process.env.MCP_SESSION_IDLE_MS, 10)
    : 30 * 60_000;

  if (!authToken) {
    console.error(
      "WARNING: MCP_AUTH_TOKEN is not set — the HTTP transport accepts unauthenticated requests from anything that can reach it. This server exposes write tools (add/edit/grab/remove) across your Servarr apps. Set MCP_AUTH_TOKEN unless this is a fully trusted network.",
    );
  }
  if (!allowedHosts) {
    console.error(
      "WARNING: MCP_ALLOWED_HOSTS is not set — the allowlist falls back to localhost/loopback/host.docker.internal only, which rejects a real LAN client. Set it to the hostname(s) this server is reached by to block DNS-rebinding attacks from a browser on the host network.",
    );
  }

  const httpApp = express();
  httpApp.use(express.json());

  const { dispose } = mountMcpHttp(httpApp, "/mcp", {
    createServer,
    authToken,
    allowedHosts,
    sessionIdleMs,
  });

  httpApp.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "http",
      port,
      enabled: enabledApps.map((a) => a.name),
    });
  });

  const httpServer = httpApp.listen(port, () => {
    console.error(`servarr-mcp HTTP transport listening on :${port}`);
  });

  const shutdown = () => {
    console.error("servarr-mcp: shutting down");
    httpServer.close();
    void dispose();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  // Default: stdio transport (for direct invocation by MCP clients via `docker run -i`).
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
