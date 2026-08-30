import { describe, expect, test, vi } from "vitest";
import {
  RADARR_PROVIDER_CONFIG,
  SONARR_PROVIDER_CONFIG,
  compactImportList,
  compactNotification,
  setImportListState,
  setNotificationManualInteraction,
} from "./provider-config.js";

function client(overrides: Record<string, unknown> = {}) {
  return {
    importLists: vi.fn(async () => []),
    importList: vi.fn(async () => ({})),
    updateImportList: vi.fn(async (_id, resource) => resource),
    notifications: vi.fn(async () => []),
    notification: vi.fn(async () => ({})),
    updateNotification: vi.fn(async (_id, resource) => resource),
    ...overrides,
  };
}

describe("provider configuration tools", () => {
  test("compact views omit opaque provider fields", () => {
    const resource = {
      id: 1,
      name: "Provider",
      implementation: "Webhook",
      fields: [{ name: "apiKey", value: "secret" }],
      onHealthIssue: true,
    };
    expect(compactImportList(resource)).not.toHaveProperty("fields");
    expect(compactNotification(resource)).not.toHaveProperty("fields");
    expect(compactNotification(resource)).toMatchObject({
      id: 1,
      onHealthIssue: true,
    });
  });

  test("Radarr state edit preserves secrets and changes only requested fields", async () => {
    const original = {
      id: 7,
      name: "Plex Watchlist",
      enabled: true,
      enableAuto: true,
      fields: [{ name: "accessToken", value: "keep-me" }],
    };
    const fake = client({ importList: vi.fn(async () => original) });

    await setImportListState(fake, RADARR_PROVIDER_CONFIG, {
      id: 7,
      enabled: false,
      automatic_add: false,
      confirm: true,
    });

    expect(fake.updateImportList).toHaveBeenCalledWith(7, {
      ...original,
      enabled: false,
      enableAuto: false,
    });
    expect(original.fields[0]!.value).toBe("keep-me");
  });

  test("Sonarr maps automatic_add and refuses unsupported enabled", async () => {
    const original = {
      id: 8,
      enableAutomaticAdd: true,
      fields: [{ name: "token", value: "keep-me" }],
    };
    const fake = client({ importList: vi.fn(async () => original) });

    await setImportListState(fake, SONARR_PROVIDER_CONFIG, {
      id: 8,
      automatic_add: false,
      confirm: true,
    });
    expect(fake.updateImportList).toHaveBeenCalledWith(8, {
      ...original,
      enableAutomaticAdd: false,
    });

    await expect(
      setImportListState(fake, SONARR_PROVIDER_CONFIG, {
        id: 8,
        enabled: false,
        confirm: true,
      }),
    ).rejects.toThrow("do not expose an enabled field");
  });

  test("import-list edit requires a change and exact id", async () => {
    const fake = client({
      importList: vi.fn(async () => ({ id: 99, enableAuto: true })),
    });
    await expect(
      setImportListState(fake, RADARR_PROVIDER_CONFIG, {
        id: 7,
        automatic_add: false,
        confirm: true,
      }),
    ).rejects.toThrow("id mismatch");
    await expect(
      setImportListState(fake, RADARR_PROVIDER_CONFIG, {
        id: 7,
        confirm: true,
      }),
    ).rejects.toThrow("at least one state change");
  });

  test("manual-interaction edit preserves every other provider field", async () => {
    const original = {
      id: 12,
      name: "Notifiarr",
      onGrab: true,
      onManualInteractionRequired: true,
      supportsOnManualInteractionRequired: true,
      fields: [{ name: "apiKey", value: "keep-me" }],
    };
    const fake = client({ notification: vi.fn(async () => original) });

    await setNotificationManualInteraction(fake, SONARR_PROVIDER_CONFIG, {
      id: 12,
      enabled: false,
      confirm: true,
    });

    expect(fake.updateNotification).toHaveBeenCalledWith(12, {
      ...original,
      onManualInteractionRequired: false,
    });
    expect(original.fields[0]!.value).toBe("keep-me");
  });

  test("manual-interaction edit refuses unsupported implementations", async () => {
    const fake = client({
      notification: vi.fn(async () => ({
        id: 12,
        onManualInteractionRequired: true,
        supportsOnManualInteractionRequired: false,
      })),
    });
    await expect(
      setNotificationManualInteraction(fake, RADARR_PROVIDER_CONFIG, {
        id: 12,
        enabled: false,
        confirm: true,
      }),
    ).rejects.toThrow("does not support");
  });
});
