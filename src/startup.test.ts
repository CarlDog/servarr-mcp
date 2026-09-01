import { describe, expect, test } from "vitest";
import { planStartup, type AppRegistration } from "./startup.js";

const noop: AppRegistration["register"] = () => {};

const APPS: AppRegistration[] = [
  { name: "Sonarr", envPrefix: "SONARR", register: noop },
  { name: "Radarr", envPrefix: "RADARR", register: noop },
];

const plan = (env: NodeJS.ProcessEnv) => planStartup(env, APPS);
const names = (env: NodeJS.ProcessEnv) => plan(env).enabled.map((a) => a.name);

describe("planStartup env combinations", () => {
  // Table over the shapes a deployment actually produces. The gating is what
  // every deployment depends on and previously had no coverage at all.
  const cases: Array<{
    label: string;
    env: NodeJS.ProcessEnv;
    enabled: string[];
    warnings: number;
  }> = [
    { label: "none set", env: {}, enabled: [], warnings: 0 },
    {
      label: "one app fully set",
      env: { SONARR_URL: "http://s", SONARR_API_KEY: "k" },
      enabled: ["Sonarr"],
      warnings: 0,
    },
    {
      label: "both apps fully set",
      env: {
        SONARR_URL: "http://s",
        SONARR_API_KEY: "k",
        RADARR_URL: "http://r",
        RADARR_API_KEY: "k2",
      },
      enabled: ["Sonarr", "Radarr"],
      warnings: 0,
    },
    {
      label: "partial: url without key",
      env: { SONARR_URL: "http://s" },
      enabled: [],
      warnings: 1,
    },
    {
      label: "partial: key without url",
      env: { SONARR_API_KEY: "k" },
      enabled: [],
      warnings: 1,
    },
    {
      label: "empty string is unset (MCP hosts inject it for blank fields)",
      env: { SONARR_URL: "http://s", SONARR_API_KEY: "" },
      enabled: [],
      warnings: 1,
    },
    {
      label: "whitespace-only is unset",
      env: { SONARR_URL: "http://s", SONARR_API_KEY: "   " },
      enabled: [],
      warnings: 1,
    },
    {
      label: "one good app does not mask another's typo",
      env: {
        SONARR_URL: "http://s",
        SONARR_API_KEY: "k",
        RADARR_URL: "http://r",
      },
      enabled: ["Sonarr"],
      warnings: 1,
    },
  ];

  for (const c of cases) {
    test(c.label, () => {
      const result = plan(c.env);
      expect(result.enabled.map((a) => a.name)).toEqual(c.enabled);
      expect(result.warnings).toHaveLength(c.warnings);
    });
  }
});

describe("half-configured warnings", () => {
  test("name the variable that is set and the one that is missing", () => {
    const { warnings } = plan({ SONARR_URL: "http://s" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("SONARR_URL");
    expect(warnings[0]).toContain("SONARR_API_KEY");
    expect(warnings[0]).toContain("NOT registered");
  });

  test("a fully unconfigured app stays silent", () => {
    // Most deployments run a subset; warning for every absent app would make
    // the real typo unreadable.
    expect(plan({}).warnings).toEqual([]);
  });
});

describe("values reaching the client", () => {
  test("surrounding whitespace is trimmed off both url and key", () => {
    const result = plan({
      SONARR_URL: "  http://s  ",
      SONARR_API_KEY: "  k  ",
    });
    expect(result.enabled).toHaveLength(1);
    expect(result.enabled[0]?.url).toBe("http://s");
    expect(result.enabled[0]?.apiKey).toBe("k");
  });

  test("registration order follows the declared app order", () => {
    expect(
      names({
        RADARR_URL: "http://r",
        RADARR_API_KEY: "k2",
        SONARR_URL: "http://s",
        SONARR_API_KEY: "k",
      }),
    ).toEqual(["Sonarr", "Radarr"]);
  });
});
