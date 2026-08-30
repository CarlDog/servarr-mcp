import { z } from "zod";
import { asText } from "../clients/base.js";

export const queueRemoveInputSchema = {
  id: z
    .number()
    .int()
    .optional()
    .describe("One queue item id. Mutually exclusive with ids."),
  ids: z
    .array(z.number().int().min(1))
    .min(1)
    .max(100)
    .refine((values) => new Set(values).size === values.length, {
      message: "ids must not contain duplicates",
    })
    .optional()
    .describe(
      "One to 100 unique queue item ids for a single server-side bulk request. Mutually exclusive with id.",
    ),
  confirm: z
    .literal(true)
    .optional()
    .describe(
      "Required when ids is used. Must be exactly true to acknowledge the bounded destructive batch.",
    ),
  remove_from_client: z
    .boolean()
    .optional()
    .describe(
      "Tell the download client to delete the download too (default false, overriding Servarr's destructive default of true).",
    ),
  blocklist: z
    .boolean()
    .optional()
    .describe(
      "Add each release to the blocklist so it is not re-grabbed (default false).",
    ),
  skip_redownload: z
    .boolean()
    .optional()
    .describe(
      "Do not trigger replacement searches for blocklisted items (default false).",
    ),
  change_category: z
    .boolean()
    .optional()
    .describe(
      "Move downloads to the configured recycle category instead of deleting them (default false).",
    ),
} as const;

type QueueRemoveArgs = {
  id?: number;
  ids?: number[];
  confirm?: true;
  remove_from_client?: boolean;
  blocklist?: boolean;
  skip_redownload?: boolean;
  change_category?: boolean;
};

type QueueRemoveClient = {
  queueRemove: (id: number, opts: Record<string, boolean>) => Promise<void>;
  queueRemoveBulk: (
    ids: number[],
    opts: Record<string, boolean>,
  ) => Promise<void>;
};

export async function handleQueueRemove(
  client: QueueRemoveClient,
  {
    id,
    ids,
    confirm,
    remove_from_client = false,
    blocklist = false,
    skip_redownload = false,
    change_category = false,
  }: QueueRemoveArgs,
) {
  if ((id === undefined) === (ids === undefined)) {
    throw new Error("Provide exactly one of id or ids.");
  }

  const opts = {
    removeFromClient: remove_from_client,
    blocklist,
    skipRedownload: skip_redownload,
    changeCategory: change_category,
  };

  if (ids !== undefined) {
    if (confirm !== true) {
      throw new Error("Bulk queue removal requires confirm: true.");
    }
    if (ids.length < 1 || ids.length > 100) {
      throw new Error("Bulk queue removal requires 1 to 100 ids.");
    }
    if (
      ids.some((value) => !Number.isInteger(value) || value < 1) ||
      new Set(ids).size !== ids.length
    ) {
      throw new Error(
        "Bulk queue removal ids must be unique positive integers.",
      );
    }
    await client.queueRemoveBulk(ids, opts);
    return asText({ removed: true, count: ids.length, ids, options: opts });
  }

  await client.queueRemove(id!, opts);
  return asText({ removed: true, id, options: opts });
}
