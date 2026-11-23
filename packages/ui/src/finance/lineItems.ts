/**
 * Pure, platform-neutral logic for line items (sub-records of a transaction, e.g. the dishes
 * on a restaurant bill): editable rows, parsing, the live total, item-by-item group splits
 * and reading stored items back for display. Shared by the mobile and web screens.
 */
import { formatMinor, parseMinor } from '@convex/shared/money';
import { allocateItemized, MAX_LINE_ITEM_TITLE, MAX_LINE_ITEMS } from '@convex/splits/domain';

/** One editable row. `participantIds: null` means everyone on the expense shares it. */
export type LineItemDraft = {
  id: string;
  title: string;
  amount: string;
  quantity: string;
  participantIds: string[] | null;
};

/** The shape the Convex mutations accept (`transactions.items`). */
export type LineItemPayload = {
  id: string;
  title: string;
  amountMinor: bigint;
  quantity?: number;
  participantIds?: string[];
};

/** A stored item normalized for display. */
export type LineItemView = {
  id: string;
  title: string;
  amountMinor: bigint;
  quantity?: number;
  participantIds: string[];
};

export { MAX_LINE_ITEM_TITLE, MAX_LINE_ITEMS };

let sequence = 0;

/** A stable, client-generated id for a new row. */
export function newLineItemId(): string {
  sequence = (sequence + 1) % 1_000_000;
  return `item-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function emptyLineItem(title = ''): LineItemDraft {
  return { id: newLineItemId(), title, amount: '', quantity: '', participantIds: null };
}

export function updateLineItem(
  rows: readonly LineItemDraft[],
  id: string,
  patch: Partial<Omit<LineItemDraft, 'id'>>,
): LineItemDraft[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function removeLineItem(rows: readonly LineItemDraft[], id: string): LineItemDraft[] {
  return rows.filter((row) => row.id !== id);
}

/** Moves a row up (`-1`) or down (`1`); out-of-range moves leave the list unchanged. */
export function moveLineItem(
  rows: readonly LineItemDraft[],
  id: string,
  delta: -1 | 1,
): LineItemDraft[] {
  const index = rows.findIndex((row) => row.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function addLineItem(rows: readonly LineItemDraft[], title = ''): LineItemDraft[] {
  return rows.length >= MAX_LINE_ITEMS ? [...rows] : [...rows, emptyLineItem(title)];
}

/** Who shares a row among the expense's people (everyone when the row has no selection). */
export function itemSharers(row: LineItemDraft, participantIds: readonly string[]): string[] {
  if (row.participantIds === null) return [...participantIds];
  return participantIds.filter((id) => row.participantIds!.includes(id));
}

/**
 * Toggles one person on a row. Turning someone off an "everyone" row selects all the others;
 * selecting the last missing person turns the row back into "everyone".
 */
export function toggleItemParticipant(
  row: LineItemDraft,
  userId: string,
  participantIds: readonly string[],
): LineItemDraft {
  const current = itemSharers(row, participantIds);
  const next = current.includes(userId)
    ? current.filter((id) => id !== userId)
    : [...current, userId];
  const everyone = participantIds.length > 0 && participantIds.every((id) => next.includes(id));
  return {
    ...row,
    participantIds: everyone ? null : participantIds.filter((id) => next.includes(id)),
  };
}

function tryParseMinor(value: string, currency: string): bigint | null {
  if (!value.trim()) return null;
  try {
    return parseMinor(value, currency);
  } catch {
    return null;
  }
}

export type LineItemsDraft = {
  /** Items ready to save; empty until every row is valid. */
  items: LineItemPayload[];
  /** Live sum of every row with a valid amount. */
  totalMinor: bigint;
  /** Per-row problem ('' when the row is fine), in row order. */
  rowErrors: string[];
  /** First problem, or '' when the items can be saved. */
  error: string;
};

function rowLabel(row: LineItemDraft, index: number): string {
  return row.title.trim() ? `“${row.title.trim()}”` : `item ${index + 1}`;
}

/** Parses editable rows into items, the live total and readable problems. */
export function computeLineItems(rows: readonly LineItemDraft[], currency: string): LineItemsDraft {
  let totalMinor = 0n;
  const items: LineItemPayload[] = [];
  const rowErrors = rows.map((row, index) => {
    const title = row.title.trim();
    const amountMinor = tryParseMinor(row.amount, currency);
    if (amountMinor !== null && amountMinor > 0n) totalMinor += amountMinor;
    const quantityText = row.quantity.trim();
    const quantity = quantityText ? Number(quantityText) : undefined;
    if (!title) return `Give ${rowLabel(row, index)} a name.`;
    if (title.length > MAX_LINE_ITEM_TITLE)
      return `Keep ${rowLabel(row, index)} under ${MAX_LINE_ITEM_TITLE} characters.`;
    if (!row.amount.trim()) return `Enter an amount for ${rowLabel(row, index)}.`;
    if (amountMinor === null) return `Enter a valid amount for ${rowLabel(row, index)}.`;
    if (amountMinor <= 0n) return `${rowLabel(row, index)} must cost more than zero.`;
    if (
      quantity !== undefined &&
      (!/^\d{1,6}$/.test(quantityText) || !Number.isSafeInteger(quantity) || quantity <= 0)
    )
      return `Quantity for ${rowLabel(row, index)} must be a whole number.`;
    items.push({
      id: row.id,
      title,
      amountMinor,
      ...(quantity === undefined ? {} : { quantity }),
      ...(row.participantIds === null ? {} : { participantIds: [...row.participantIds] }),
    });
    return '';
  });
  const firstRowError = rowErrors.find(Boolean) ?? '';
  const error = !rows.length
    ? 'Add at least one item.'
    : rows.length > MAX_LINE_ITEMS
      ? `Use at most ${MAX_LINE_ITEMS} items.`
      : firstRowError;
  return {
    items: error ? [] : items,
    totalMinor,
    rowErrors: rows.map((_, index) => rowErrors[index] ?? ''),
    error,
  };
}

/** Items for a personal transaction: no per-person assignments. */
export function personalItemsPayload(items: readonly LineItemPayload[]): LineItemPayload[] {
  return items.map(({ participantIds: _participantIds, ...item }) => item);
}

export type ItemizedSplit = {
  /** Participant rows for addExpense / updateExpense; empty until the split is valid. */
  participants: { userId: string; amountMinor: bigint; method: 'itemized' }[];
  /** Items to save, with assignments limited to the selected people. */
  items: LineItemPayload[];
  /** Best-effort live amount per selected person. */
  preview: { userId: string; amountMinor: bigint | null }[];
  error: string;
};

/**
 * Splits rows item by item between `participantIds`: each item is shared equally by the
 * people ticked on it (everyone by default), using the same allocation as the server.
 */
export function computeItemizedSplit(
  rows: readonly LineItemDraft[],
  participantIds: readonly string[],
  currency: string,
): ItemizedSplit {
  const parsed = computeLineItems(rows, currency);
  const live = rows
    .map((row) => ({ amountMinor: tryParseMinor(row.amount, currency), row }))
    .filter(
      (entry): entry is { amountMinor: bigint; row: LineItemDraft } =>
        entry.amountMinor !== null &&
        entry.amountMinor > 0n &&
        itemSharers(entry.row, participantIds).length > 0,
    )
    .map((entry) => ({
      amountMinor: entry.amountMinor,
      participantIds: itemSharers(entry.row, participantIds),
    }));
  let preview: ItemizedSplit['preview'] = participantIds.map((userId) => ({
    userId,
    amountMinor: null,
  }));
  if (live.length && participantIds.length) {
    try {
      preview = allocateItemized(live, participantIds);
    } catch {
      // Keep the empty preview while the rows are incomplete.
    }
  }
  const empty = { participants: [], items: [], preview };
  if (!participantIds.length)
    return { ...empty, error: 'Choose at least one person to split with.' };
  if (parsed.error) return { ...empty, error: parsed.error };
  const nobody = rows.findIndex((row) => !itemSharers(row, participantIds).length);
  if (nobody >= 0)
    return { ...empty, error: `Choose who shared ${rowLabel(rows[nobody]!, nobody)}.` };
  const items = parsed.items.map((item, index) => {
    const row = rows[index]!;
    const { participantIds: _participantIds, ...rest } = item;
    return row.participantIds === null
      ? rest
      : { ...rest, participantIds: itemSharers(row, participantIds) };
  });
  try {
    const shares = allocateItemized(items, participantIds);
    return {
      participants: shares.map((share) => ({ ...share, method: 'itemized' as const })),
      items,
      preview: shares,
      error: '',
    };
  } catch {
    return { ...empty, error: 'Every item needs at least one person.' };
  }
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

/** Reads `items` from a stored (cloud or local) transaction, skipping malformed entries. */
export function readLineItems(value: unknown): LineItemView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): LineItemView[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const amountMinor = toBigInt(record.amountMinor);
    if (amountMinor === null || typeof record.title !== 'string') return [];
    const quantity =
      typeof record.quantity === 'number' && Number.isSafeInteger(record.quantity)
        ? record.quantity
        : undefined;
    return [
      {
        id: typeof record.id === 'string' && record.id ? record.id : `item-${index}`,
        title: record.title,
        amountMinor,
        ...(quantity === undefined ? {} : { quantity }),
        participantIds: Array.isArray(record.participantIds)
          ? record.participantIds.filter((id): id is string => typeof id === 'string')
          : [],
      },
    ];
  });
}

/** Minor units to an editable decimal: 12050n, INR → "120.50". */
function minorText(amount: bigint, currency: string): string {
  try {
    const scale = parseMinor('1', currency);
    const digits = scale.toString().length - 1;
    const fraction = digits ? `.${(amount % scale).toString().padStart(digits, '0')}` : '';
    return `${amount / scale}${fraction}`;
  } catch {
    return amount.toString();
  }
}

/** Editable rows for stored items (opening a transaction to edit). */
export function lineItemDrafts(value: unknown, currency: string): LineItemDraft[] {
  return readLineItems(value).map((item) => ({
    id: item.id,
    title: item.title,
    amount: minorText(item.amountMinor, currency),
    quantity: item.quantity === undefined ? '' : String(item.quantity),
    participantIds: item.participantIds.length ? item.participantIds : null,
  }));
}

/** Editable decimal for a total (used as the read-only amount while itemized). */
export function lineItemsTotalInput(totalMinor: bigint, currency: string): string {
  return totalMinor > 0n ? minorText(totalMinor, currency) : '';
}

export function formatLineAmount(amount: bigint | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return '—';
  try {
    return formatMinor(amount, currency);
  } catch {
    return amount.toString();
  }
}

export type ItemizedBreakdown = {
  items: (LineItemView & { sharers: string[] })[];
  /** Each person's total across the items they share, in participant order. */
  totals: { userId: string; amountMinor: bigint }[];
};

/**
 * Receipt-style breakdown of stored items for an itemized group expense: who shares each item
 * (everyone on the expense when none are ticked) and each person's stored total.
 */
export function itemizedBreakdown(
  items: readonly LineItemView[],
  participantRows: readonly { userId: string; amountMinor: bigint }[],
): ItemizedBreakdown {
  const participantIds = participantRows.map((row) => row.userId);
  return {
    items: items.map((item) => ({
      ...item,
      sharers: item.participantIds.length ? item.participantIds : participantIds,
    })),
    totals: participantRows.map((row) => ({ userId: row.userId, amountMinor: row.amountMinor })),
  };
}

export type PersonalItemsState = {
  /** Line items are switched on. */
  active: boolean;
  /** The amount to save: the items' total while active ('' when it is zero). */
  amount: string;
  /** First problem with the items, or ''. */
  error: string;
  /** Items to save (personal: no assignments); empty while inactive or invalid. */
  items: LineItemPayload[];
  rowErrors: string[];
};

/** State of the "Itemize" section on a personal transaction form. */
export function personalItemsState(
  rows: readonly LineItemDraft[] | null | undefined,
  currency: string,
  amount: string,
): PersonalItemsState {
  if (!rows) return { active: false, amount, error: '', items: [], rowErrors: [] };
  const parsed = computeLineItems(rows, currency);
  return {
    active: true,
    amount: lineItemsTotalInput(parsed.totalMinor, currency),
    error: parsed.error,
    items: personalItemsPayload(parsed.items),
    rowErrors: parsed.rowErrors,
  };
}

/** Rows to start itemizing from: one row carrying whatever amount was already typed. */
export function startItemizing(amount: string, title = ''): LineItemDraft[] {
  return [{ ...emptyLineItem(title.trim().slice(0, MAX_LINE_ITEM_TITLE)), amount: amount.trim() }];
}
