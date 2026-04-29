#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { SonarrClient, registerSonarrTools } from "./sonarr.js";
import { RadarrClient, registerRadarrTools } from "./radarr.js";
import { LidarrClient, registerLidarrTools } from "./lidarr.js";
import { ReadarrClient, registerReadarrTools } from "./readarr.js";
import { ProwlarrClient, registerProwlarrTools } from "./prowlarr.js";

interface AppRegistration {
  name: string;
  envPrefix: string;
  register: (server: McpServer, url: string, apiKey: string) => void;
}

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

interface EnabledApp {
  name: string;
  url: string;
  apiKey: string;
  register: (server: McpServer, url: string, apiKey: string) => void;
}

const enabledApps: EnabledApp[] = [];
for (const app of apps) {
  const url = process.env[`${app.envPrefix}_URL`];
  const apiKey = process.env[`${app.envPrefix}_API_KEY`];
  if (url && apiKey) {
    enabledApps.push({
      name: app.name,
      url,
      apiKey,
      register: app.register,
    });
  }
}

if (enabledApps.length === 0) {
  console.error(
    "No Servarr apps configured. Set <APP>_URL and <APP>_API_KEY for at least one of:",
  );
  console.error("  " + apps.map((a) => a.envPrefix).join(", "));
  process.exit(1);
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "servarr-mcp",
    version: "0.1.0",
  });
  for (const app of enabledApps) {
    app.register(server, app.url, app.apiKey);
  }
  return server;
}

console.error(
  `servarr-mcp: enabled = ${enabledApps.map((a) => a.name).join(", ")}`,
);

const portStr = process.env.MCP_PORT;
const port = portStr ? Number.parseInt(portStr, 10) : null;
if (portStr && (port === null || Number.isNaN(port))) {
  console.error(`Invalid MCP_PORT: ${portStr}`);
  process.exit(1);
}

if (port) {
  // HTTP transport (long-lived server, e.g. for Portainer/Compose deployment).
  const httpApp = express();
  httpApp.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  httpApp.all("/mcp", async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (
        !sessionId &&
        req.method === "POST" &&
        isInitializeRequest(req.body)
      ) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports[id] = transport;
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        const server = createServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: missing or unknown session, or non-initialize POST",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  httpApp.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "http",
      port,
      enabled: enabledApps.map((a) => a.name),
    });
  });

  httpApp.listen(port, () => {
    console.error(`servarr-mcp HTTP transport listening on :${port}`);
  });
} else {
  // Default: stdio transport (for direct invocation by MCP clients via `docker run -i`).
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
