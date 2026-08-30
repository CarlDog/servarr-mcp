import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ANN_CONFIG_EDIT, ANN_READ, asText } from "../clients/base.js";

type ProviderClient = {
  importLists: () => Promise<unknown>;
  importList: (id: number) => Promise<unknown>;
  updateImportList: (
    id: number,
    resource: Record<string, unknown>,
  ) => Promise<unknown>;
  notifications: () => Promise<unknown>;
  notification: (id: number) => Promise<unknown>;
  updateNotification: (
    id: number,
    resource: Record<string, unknown>,
  ) => Promise<unknown>;
};

type AppConfig = {
  prefix: "sonarr" | "radarr" | "lidarr" | "readarr";
  label: "Sonarr" | "Radarr" | "Lidarr" | "Readarr";
  hasImportListEnabled: boolean;
  hasManualInteractionEvent: boolean;
};

type ListArgs = { limit?: number; full?: boolean };
type ImportListStateArgs = {
  id: number;
  confirm: true;
  automatic_add?: boolean;
  enabled?: boolean;
};

const LIST_SCHEMA = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum resources to return (default 50, max 100)."),
  full: z
    .boolean()
    .optional()
    .describe(
      "Return full upstream resources instead of compact inspection fields (default false). Sensitive provider fields remain redacted.",
    ),
} as const;

const COMMON_IMPORT_STATE_SCHEMA = {
  id: z.number().int().min(1).describe("Import-list id from the list tool."),
  automatic_add: z
    .boolean()
    .optional()
    .describe("Enable or disable automatic additions from this list."),
  confirm: z
    .literal(true)
    .describe("Must be exactly true to acknowledge the configuration change."),
} as const;

function records(
  value: unknown,
  label: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value))
    throw new Error(`${label} response was not an array.`);
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} response was not an object.`);
  }
  return value as Record<string, unknown>;
}

function pick(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

const IMPORT_LIST_FIELDS = [
  "id",
  "name",
  "implementationName",
  "implementation",
  "enabled",
  "enableAuto",
  "enableAutomaticAdd",
  "rootFolderPath",
  "qualityProfileId",
  "metadataProfileId",
  "listType",
  "message",
  "tags",
] as const;

const NOTIFICATION_FIELDS = [
  "id",
  "name",
  "implementationName",
  "implementation",
  "onGrab",
  "onDownload",
  "onUpgrade",
  "onImportComplete",
  "onRename",
  "onSeriesAdd",
  "onSeriesDelete",
  "onEpisodeFileDelete",
  "onEpisodeFileDeleteForUpgrade",
  "onMovieAdded",
  "onMovieDelete",
  "onMovieFileDelete",
  "onMovieFileDeleteForUpgrade",
  "onHealthIssue",
  "includeHealthWarnings",
  "onHealthRestored",
  "onApplicationUpdate",
  "onManualInteractionRequired",
  "supportsOnManualInteractionRequired",
  "message",
  "tags",
] as const;

export function compactImportList(
  resource: Record<string, unknown>,
): Record<string, unknown> {
  return pick(resource, IMPORT_LIST_FIELDS);
}

export function compactNotification(
  resource: Record<string, unknown>,
): Record<string, unknown> {
  return pick(resource, NOTIFICATION_FIELDS);
}

function formatList(
  value: unknown,
  label: string,
  { limit = 50, full = false }: ListArgs,
  compact: (resource: Record<string, unknown>) => Record<string, unknown>,
) {
  const all = records(value, label);
  const selected = all.slice(0, limit);
  return asText({
    count: selected.length,
    total: all.length,
    truncated: all.length > selected.length,
    items: full ? selected : selected.map(compact),
  });
}

export async function setImportListState(
  client: ProviderClient,
  config: AppConfig,
  { id, confirm, automatic_add, enabled }: ImportListStateArgs,
) {
  if (confirm !== true)
    throw new Error("Import-list edits require confirm: true.");
  if (automatic_add === undefined && enabled === undefined) {
    throw new Error("Provide at least one state change.");
  }
  if (!config.hasImportListEnabled && enabled !== undefined) {
    throw new Error(
      `${config.label} import lists do not expose an enabled field.`,
    );
  }

  // The raw resource is intentionally kept internal. Provider Field[] values
  // can contain credentials; replacing only the targeted booleans and PUTting
  // the complete resource preserves those secrets without returning them.
  const resource = record(
    await client.importList(id),
    `${config.label} import list`,
  );
  if (Number(resource.id) !== id) throw new Error("Import-list id mismatch.");

  const changed: Record<string, boolean> = {};
  if (enabled !== undefined) {
    if (typeof resource.enabled !== "boolean") {
      throw new Error(
        `${config.label} import list has no boolean enabled field.`,
      );
    }
    resource.enabled = enabled;
    changed.enabled = enabled;
  }
  if (automatic_add !== undefined) {
    const field =
      typeof resource.enableAuto === "boolean"
        ? "enableAuto"
        : typeof resource.enableAutomaticAdd === "boolean"
          ? "enableAutomaticAdd"
          : undefined;
    if (!field) throw new Error("Import list has no automatic-add field.");
    resource[field] = automatic_add;
    changed.automatic_add = automatic_add;
  }

  const updated = record(
    await client.updateImportList(id, resource),
    `${config.label} updated import list`,
  );
  return asText({
    updated: true,
    id,
    changed,
    resource: compactImportList(updated),
  });
}

export async function setNotificationManualInteraction(
  client: ProviderClient,
  config: AppConfig,
  { id, enabled, confirm }: { id: number; enabled: boolean; confirm: true },
) {
  if (confirm !== true) {
    throw new Error("Notification edits require confirm: true.");
  }
  if (!config.hasManualInteractionEvent) {
    throw new Error(`${config.label} does not expose this notification event.`);
  }

  const resource = record(
    await client.notification(id),
    `${config.label} notification`,
  );
  if (Number(resource.id) !== id) throw new Error("Notification id mismatch.");
  if (typeof resource.onManualInteractionRequired !== "boolean") {
    throw new Error(
      "Notification does not expose onManualInteractionRequired.",
    );
  }
  if (resource.supportsOnManualInteractionRequired === false) {
    throw new Error("Notification implementation does not support this event.");
  }
  resource.onManualInteractionRequired = enabled;
  const updated = record(
    await client.updateNotification(id, resource),
    `${config.label} updated notification`,
  );
  return asText({
    updated: true,
    id,
    on_manual_interaction_required: enabled,
    resource: compactNotification(updated),
  });
}

export function registerProviderConfigTools(
  server: McpServer,
  client: ProviderClient,
  config: AppConfig,
): void {
  const { prefix, label } = config;

  server.registerTool(
    `${prefix}_list_import_lists`,
    {
      title: `${label}: List Import Lists`,
      description: `Inspect configured ${label} import lists with compact, secret-free defaults. Use full only when provider-specific fields are required; sensitive Field values remain redacted.`,
      inputSchema: LIST_SCHEMA,
      annotations: ANN_READ,
    },
    async (args) =>
      formatList(
        await client.importLists(),
        `${label} import lists`,
        args,
        compactImportList,
      ),
  );

  if (config.hasImportListEnabled) {
    server.registerTool(
      `${prefix}_set_import_list_state`,
      {
        title: `${label}: Set Import List State`,
        description:
          "Confirm-gated read-modify-write of enabled and/or automatic-add state. Preserves all opaque provider fields and credentials.",
        inputSchema: {
          ...COMMON_IMPORT_STATE_SCHEMA,
          enabled: z
            .boolean()
            .optional()
            .describe("Enable or disable the import-list provider."),
        },
        annotations: ANN_CONFIG_EDIT,
      },
      async (args) => setImportListState(client, config, args),
    );
  } else {
    server.registerTool(
      `${prefix}_set_import_list_state`,
      {
        title: `${label}: Set Import List State`,
        description:
          "Confirm-gated read-modify-write of automatic-add state. This app's API has no separate provider-enabled field. Preserves all opaque provider fields and credentials.",
        inputSchema: COMMON_IMPORT_STATE_SCHEMA,
        annotations: ANN_CONFIG_EDIT,
      },
      async (args) => setImportListState(client, config, args),
    );
  }

  server.registerTool(
    `${prefix}_list_notifications`,
    {
      title: `${label}: List Notifications`,
      description: `Inspect configured ${label} notification connections and event flags with compact, secret-free defaults. Full provider fields are available redacted with full: true.`,
      inputSchema: LIST_SCHEMA,
      annotations: ANN_READ,
    },
    async (args) =>
      formatList(
        await client.notifications(),
        `${label} notifications`,
        args,
        compactNotification,
      ),
  );

  if (config.hasManualInteractionEvent) {
    server.registerTool(
      `${prefix}_set_notification_manual_interaction`,
      {
        title: `${label}: Set Manual-Interaction Notification`,
        description:
          "Enable or disable the On Manual Interaction Required event on one notification connection through a confirm-gated read-modify-write. All other event and provider settings are preserved.",
        inputSchema: {
          id: z
            .number()
            .int()
            .min(1)
            .describe("Notification id from the list tool."),
          enabled: z.boolean().describe("Desired event state."),
          confirm: z
            .literal(true)
            .describe(
              "Must be exactly true to acknowledge the configuration change.",
            ),
        },
        annotations: ANN_CONFIG_EDIT,
      },
      async (args) => setNotificationManualInteraction(client, config, args),
    );
  }
}

export const SONARR_PROVIDER_CONFIG = {
  prefix: "sonarr",
  label: "Sonarr",
  hasImportListEnabled: false,
  hasManualInteractionEvent: true,
} as const;

export const RADARR_PROVIDER_CONFIG = {
  prefix: "radarr",
  label: "Radarr",
  hasImportListEnabled: true,
  hasManualInteractionEvent: true,
} as const;

export const LIDARR_PROVIDER_CONFIG = {
  prefix: "lidarr",
  label: "Lidarr",
  hasImportListEnabled: false,
  hasManualInteractionEvent: false,
} as const;

export const READARR_PROVIDER_CONFIG = {
  prefix: "readarr",
  label: "Readarr",
  hasImportListEnabled: false,
  hasManualInteractionEvent: false,
} as const;
