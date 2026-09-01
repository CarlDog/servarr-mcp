import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface AppRegistration {
  name: string;
  envPrefix: string;
  register: (server: McpServer, url: string, apiKey: string) => void;
}

export interface EnabledApp {
  name: string;
  url: string;
  apiKey: string;
  register: (server: McpServer, url: string, apiKey: string) => void;
}

export interface StartupPlan {
  enabled: EnabledApp[];
  warnings: string[];
}

// MCP hosts inject "" for a blank config field, and a hand-edited compose file
// can leave "  ". Both mean unset; without the trim the whitespace case
// registers an app whose every call fails at request time.
function read(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

/**
 * Decide which apps to register, and what the operator needs told.
 *
 * Pure so the env combinations can be tested: the gating is what every
 * deployment depends on, and a half-configured app used to vanish from the
 * tool list with nothing on stderr and nothing in /health.
 */
export function planStartup(
  env: NodeJS.ProcessEnv,
  apps: readonly AppRegistration[],
): StartupPlan {
  const enabled: EnabledApp[] = [];
  const warnings: string[] = [];

  for (const app of apps) {
    const urlVar = `${app.envPrefix}_URL`;
    const keyVar = `${app.envPrefix}_API_KEY`;
    const url = read(env, urlVar);
    const apiKey = read(env, keyVar);

    if (url && apiKey) {
      enabled.push({ name: app.name, url, apiKey, register: app.register });
      continue;
    }
    // Neither set is the ordinary "this app isn't deployed" case; exactly one
    // is a typo, and it is the likeliest real misconfiguration.
    if (url || apiKey) {
      const present = url ? urlVar : keyVar;
      const missing = url ? keyVar : urlVar;
      warnings.push(
        `${app.name} is half-configured: ${present} is set but ${missing} is missing or empty, so ${app.name} tools are NOT registered.`,
      );
    }
  }

  return { enabled, warnings };
}
