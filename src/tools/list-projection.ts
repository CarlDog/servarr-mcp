import { pickFields } from "./_paging.js";

export const COMMON_QUEUE_FIELDS = [
  "id",
  "title",
  "status",
  "trackedDownloadStatus",
  "trackedDownloadState",
  "statusMessages",
  "errorMessage",
  "downloadId",
  "protocol",
  "downloadClient",
  "indexer",
  "size",
  "sizeleft",
  "timeleft",
  "estimatedCompletionTime",
] as const;

export function asRecordArray(
  value: unknown,
  label: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${label} returned a non-array response`);
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

export function projectRecordArray(
  value: unknown,
  fields: readonly string[],
  label: string,
): Array<Record<string, unknown>> {
  return asRecordArray(value, label).map((record) =>
    pickFields(record, fields),
  );
}

export function projectQueuePage(
  value: unknown,
  appFields: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Queue endpoint returned a non-object response");
  }

  const page = value as Record<string, unknown>;
  const fields = [...new Set([...appFields, ...COMMON_QUEUE_FIELDS])];
  return {
    ...page,
    records: projectRecordArray(page.records, fields, "Queue endpoint"),
  };
}
