import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Loads .env (if present) into process.env before tests run, so
    // integration suites that gate on `process.env.SONARR_URL` etc.
    // pick up local credentials automatically. CI doesn't ship a .env
    // → env vars stay unset → integration suites skip themselves.
    env: loadDotenv(),
  },
});

function loadDotenv(): Record<string, string> {
  const envPath = fileURLToPath(new URL("./.env", import.meta.url));
  let text: string;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
