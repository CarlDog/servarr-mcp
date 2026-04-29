#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({
  name: "servarr-mcp",
  version: "0.1.0",
});

const enabled: string[] = [];

for (const app of apps) {
  const url = process.env[`${app.envPrefix}_URL`];
  const apiKey = process.env[`${app.envPrefix}_API_KEY`];
  if (url && apiKey) {
    app.register(server, url, apiKey);
    enabled.push(app.name);
  }
}

if (enabled.length === 0) {
  console.error(
    "No Servarr apps configured. Set <APP>_URL and <APP>_API_KEY for at least one of:",
  );
  console.error("  " + apps.map((a) => a.envPrefix).join(", "));
  process.exit(1);
}

console.error(`servarr-mcp: enabled = ${enabled.join(", ")}`);

await server.connect(new StdioServerTransport());
