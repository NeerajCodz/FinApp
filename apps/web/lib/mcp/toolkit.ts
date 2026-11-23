import type { ConvexHttpClient } from 'convex/browser';
import type { Id, TableNames } from '@convex/_generated/dataModel';
import { z } from 'zod';
import { presentMoney } from './money';

export const READ_SCOPE = 'finapp:read';
export const WRITE_SCOPES = [
  'finapp:write:finance',
  'finapp:write:social',
  'finapp:write:groups',
  'finapp:write:personal',
] as const;
export type McpScope = typeof READ_SCOPE | (typeof WRITE_SCOPES)[number];
export type ToolDomain = 'finance' | 'social' | 'groups' | 'personal';
export type WidgetId = 'overview' | 'transactions' | 'groupBalances' | 'expense' | 'settleUp';

type Shape = Record<string, z.ZodType>;

export type ToolSpec<S extends Shape = Shape> = {
  name: `finapp.${ToolDomain}.${string}`;
  title: string;
  description: string;
  scope: McpScope;
  input: S;
  /** Archives, deletes, removals: hosts should confirm with the user. */
  destructive?: boolean;
  /** Safe to retry with the same arguments (reads, or writes keyed by clientMutationId). */
  idempotent?: boolean;
  /** In-chat UI resource rendered for this tool's result. */
  widget?: WidgetId;
  /** One or two plain-language sentences prepended to the JSON text for non-UI clients. */
  summarize?: (data: unknown) => string | undefined;
  run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
};
export type AnyToolSpec = ToolSpec<Shape>;

/** Keeps per-tool argument inference while letting tools live in one heterogeneous list. */
export function defineTool<S extends Shape>(spec: ToolSpec<S>): AnyToolSpec {
  return spec as unknown as AnyToolSpec;
}

export type ToolFactory = (client: ConvexHttpClient) => AnyToolSpec[];

export function domainOf(name: string): ToolDomain {
  return name.split('.')[1] as ToolDomain;
}

/** Narrow a validated string to a Convex document id; Convex re-validates on the server. */
export function id<T extends TableNames>(value: string): Id<T>;
export function id<T extends TableNames>(value: string | undefined): Id<T> | undefined;
export function id<T extends TableNames>(value: string | null): Id<T> | null;
export function id<T extends TableNames>(
  value: string | null | undefined,
): Id<T> | null | undefined;
export function id<T extends TableNames>(
  value: string | null | undefined,
): Id<T> | null | undefined {
  return value as Id<T> | null | undefined;
}

export function presentResult(data: unknown): unknown {
  return presentMoney(data);
}

// ---------- Shared schemas ----------

export const minorUnits = z
  .string()
  .regex(/^\d{1,19}$/, 'Use a non-negative integer string in minor currency units.')
  .transform((value) => BigInt(value))
  .refine((value) => value <= 9_223_372_036_854_775_807n, 'Amount exceeds signed 64-bit range.')
  .describe('Integer string in minor currency units, e.g. "12550" = 125.50 in INR or USD.');
export const currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter ISO 4217 currency code.')
  .transform((value) => value.toUpperCase())
  .describe('ISO 4217 code, e.g. "INR" or "USD". Must match the account or group currency.');
export const timestamp = z
  .number()
  .finite()
  .describe('Unix epoch milliseconds, e.g. 1767225600000 for 2026-01-01T00:00:00Z.');
export const mutationId = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Optional idempotency key (UUID). Reuse the same value when retrying so the change is applied once.',
  );
export const confirm = (action: string) =>
  z
    .literal(true)
    .describe(`Set true only after the user explicitly confirms they want to ${action}.`);
export const docId = (what: string) => z.string().min(1).max(64).describe(`${what} id.`);
export const limit = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(25)
  .describe('Maximum results to return; hard limit 100.');
export const cursor = z
  .string()
  .nullable()
  .optional()
  .describe('nextCursor from the previous page; omit for the first page.');
export const page = (args: { limit?: number; cursor?: string | null }) => ({
  numItems: args.limit ?? 25,
  cursor: args.cursor ?? null,
});
export function idempotencyKey(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : crypto.randomUUID();
}

// ---------- Line items (shared contract with the line-items feature) ----------

export const lineItem = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('Stable item id; omit to have one generated. Keep existing ids when editing.'),
  title: z.string().min(1).max(200).describe('Item name, e.g. "Margherita pizza".'),
  amountMinor: minorUnits.describe('Line total in minor units (price × quantity).'),
  quantity: z.number().int().min(1).max(10_000).optional().describe('Units purchased; default 1.'),
  participantIds: z
    .array(z.string().min(1).max(64))
    .max(100)
    .optional()
    .describe(
      "Group expenses with method 'itemized': user ids sharing this item equally. Empty or omitted = every participant.",
    ),
});
export const lineItems = z
  .array(lineItem)
  .min(1)
  .max(100)
  .optional()
  .describe(
    'Optional itemised breakdown. Item amounts must sum exactly to amountMinor (else ITEMS_TOTAL_MISMATCH).',
  );

export type LineItemInput = z.infer<typeof lineItem>;
export type LineItemPayload = {
  id: string;
  title: string;
  amountMinor: bigint;
  quantity?: number;
  participantIds?: Id<'users'>[];
};

export class ToolInputError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Validates the sum invariant locally and fills generated ids, matching the backend contract. */
export function prepareItems(
  items: LineItemInput[] | undefined,
  amountMinor: bigint,
): LineItemPayload[] | undefined {
  if (!items) return undefined;
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0n);
  if (total !== amountMinor) throw new ToolInputError('ITEMS_TOTAL_MISMATCH');
  return items.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    title: item.title,
    amountMinor: item.amountMinor,
    ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
    ...(item.participantIds === undefined
      ? {}
      : { participantIds: item.participantIds.map((value) => id<'users'>(value)) }),
  }));
}

/**
 * Adds `items` to mutation args only when provided. Convex arg validators gain `items` with the
 * line-items feature; until then omitting the key keeps every existing call valid, and the
 * generated arg types (which may not list `items` yet) stay the declared shape.
 */
export function withItems<T extends object>(args: T, items: LineItemPayload[] | undefined): T {
  return items ? Object.assign(args, { items }) : args;
}
