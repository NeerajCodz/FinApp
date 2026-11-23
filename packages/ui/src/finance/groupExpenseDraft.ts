/**
 * Pure, platform-neutral logic for the group expense composer: parsing what people type,
 * live per-member previews, the remaining-to-allocate indicator and the participant rows the
 * Convex mutations expect. Shared by the mobile and web composers so both behave the same.
 */
import { formatMinor, parseMinor } from '@convex/shared/money';
import { allocateParticipants } from '@convex/splits/domain';

export type GroupExpenseMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export type ExpenseShare = { userId: string; amountMinor: bigint };
export type ExpenseParticipantInput = ExpenseShare & {
  method: GroupExpenseMethod;
  basisValue?: string;
};
export type AllocationTone = 'positive' | 'warning' | 'destructive';
export type AllocationStatus = {
  tone: AllocationTone;
  /** Short status, e.g. "₹120 left to assign" or "All assigned". */
  label: string;
  /** Remaining in the method's unit (minor units, basis points or nothing for equal/shares). */
  remaining: bigint | null;
};

/** 100% expressed in basis points, the unit percentage splits are stored in. */
export const FULL_PERCENT_BASIS_POINTS = 10_000n;

/**
 * Parses a percentage the way people type it ("33.33", "33.33%", "50", "12,5") into basis
 * points (hundredths of a percent). Accepts up to two decimals and values from 0 to 100.
 */
export function parsePercentBasisPoints(input: string): bigint {
  const normalized = input.trim().replace(/\s*%$/, '').replace(',', '.').trim();
  const match = /^(\d{0,3})(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match || (!match[1] && !match[2])) throw new Error('INVALID_PERCENT');
  const whole = BigInt(match[1] || '0');
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  const basisPoints = whole * 100n + fraction;
  if (basisPoints > FULL_PERCENT_BASIS_POINTS) throw new Error('INVALID_PERCENT');
  return basisPoints;
}

/** Basis points back to an editable percentage: 3333n → "33.33", 5000n → "50". */
export function formatBasisPoints(basisPoints: bigint): string {
  const negative = basisPoints < 0n;
  const absolute = negative ? -basisPoints : basisPoints;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  const text = fraction
    ? `${whole}.${fraction.toString().padStart(2, '0').replace(/0$/, '')}`
    : `${whole}`;
  return negative ? `-${text}` : text;
}

/** Minor units back to an editable decimal amount in a currency: 12050n, INR → "120.50". */
export function minorToInput(amount: bigint, currency: string): string {
  const scale = parseMinor('1', currency);
  const digits = scale.toString().length - 1;
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const fraction = digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : '';
  return `${negative ? '-' : ''}${absolute / scale}${fraction}`;
}

function tryParseMinor(value: string | undefined, currency: string): bigint | null {
  if (!value?.trim()) return null;
  try {
    return parseMinor(value, currency);
  } catch {
    return null;
  }
}

function tryParsePercent(value: string | undefined): bigint | null {
  if (!value?.trim()) return null;
  try {
    return parsePercentBasisPoints(value);
  } catch {
    return null;
  }
}

function tryParseShares(value: string | undefined): bigint | null {
  const text = value?.trim() ?? '';
  return /^\d{1,6}$/.test(text) ? BigInt(text) : null;
}

/** Parses one member's split value into the unit stored as basisValue for that method. */
export function parseBasisValue(
  method: Exclude<GroupExpenseMethod, 'equal'>,
  value: string | undefined,
  currency: string,
): bigint | null {
  if (method === 'shares') return tryParseShares(value);
  if (method === 'percentage') return tryParsePercent(value);
  const parsed = tryParseMinor(value, currency);
  return parsed !== null && parsed >= 0n ? parsed : null;
}

/** The editable text for a stored participant row (used when opening an expense to edit). */
export function basisInputFromRow(
  method: GroupExpenseMethod,
  row: { amountMinor?: unknown; basisValue?: unknown },
  currency: string,
): string {
  if (method === 'equal') return '';
  const raw =
    typeof row.basisValue === 'string' && /^\d+$/.test(row.basisValue)
      ? BigInt(row.basisValue)
      : method === 'exact'
        ? toBigInt(row.amountMinor)
        : null;
  if (raw === null) return '';
  if (method === 'shares') return raw.toString();
  if (method === 'percentage') return formatBasisPoints(raw);
  return minorToInput(raw, currency);
}

export function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

export type ExpenseDraftInput = {
  amount: string;
  currency: string;
  method: GroupExpenseMethod;
  participantIds: readonly string[];
  basis: Readonly<Record<string, string>>;
};

export type ExpenseDraft = {
  /** Parsed total, or null while the amount is empty or invalid. */
  totalMinor: bigint | null;
  /** Final per-member amounts; empty until the split is valid. */
  shares: ExpenseShare[];
  /** Rows ready for addExpense / updateExpense; empty until the split is valid. */
  participants: ExpenseParticipantInput[];
  /** Best-effort live amount per selected member, even while the split is incomplete. */
  preview: { userId: string; amountMinor: bigint | null }[];
  allocation: AllocationStatus;
  /** Human-readable reason the split cannot be saved yet, or '' when it is valid. */
  error: string;
};

function sum(values: readonly (bigint | null)[]): bigint {
  return values.reduce<bigint>((total, value) => total + (value ?? 0n), 0n);
}

/**
 * Computes the live state of a split: a preview for every selected member, the remaining
 * amount still to assign and, once everything adds up, the exact participant rows to save.
 */
export function computeExpenseDraft(input: ExpenseDraftInput): ExpenseDraft {
  const { currency, method, participantIds, basis } = input;
  let totalMinor: bigint | null = null;
  let amountError = '';
  if (!input.amount.trim()) amountError = 'Enter the total amount.';
  else {
    totalMinor = tryParseMinor(input.amount, currency);
    if (totalMinor === null) amountError = `Enter a valid amount in ${currency || 'the currency'}.`;
    else if (totalMinor <= 0n) {
      amountError = 'Enter an amount greater than zero.';
      totalMinor = null;
    }
  }
  const values =
    method === 'equal'
      ? participantIds.map(() => null)
      : participantIds.map((id) => parseBasisValue(method, basis[id], currency));
  const preview = previewAmounts(totalMinor, method, participantIds, values);
  const allocation = allocationStatus(totalMinor, method, participantIds, values, basis, currency);
  const empty = { totalMinor, shares: [], participants: [], preview, allocation };
  if (amountError) return { ...empty, error: amountError };
  if (!participantIds.length)
    return { ...empty, error: 'Choose at least one person to split with.' };
  if (method !== 'equal') {
    const missing = participantIds.findIndex((id) => !(basis[id] ?? '').trim());
    if (missing >= 0) return { ...empty, error: 'Enter a value for every selected person.' };
    const invalid = values.findIndex((value) => value === null);
    if (invalid >= 0)
      return {
        ...empty,
        error:
          method === 'shares'
            ? 'Shares must be whole numbers.'
            : method === 'percentage'
              ? 'Percentages must be between 0 and 100 with up to two decimals.'
              : `Enter valid amounts in ${currency}.`,
      };
    if (allocation.tone !== 'positive') return { ...empty, error: allocationError(method) };
  }
  try {
    const shares = allocateParticipants(
      totalMinor!,
      participantIds,
      method,
      method === 'equal' ? undefined : values.map((value) => value!),
    );
    const participants = shares.map((share, index) => ({
      ...share,
      method,
      ...(method === 'equal' ? {} : { basisValue: values[index]!.toString() }),
    }));
    return { ...empty, shares, participants, preview: shares, error: '' };
  } catch {
    return { ...empty, error: allocationError(method) };
  }
}

function allocationError(method: GroupExpenseMethod): string {
  return method === 'exact'
    ? 'Amounts must add up to the total.'
    : method === 'percentage'
      ? 'Percentages must add up to 100%.'
      : method === 'shares'
        ? 'Give at least one person a share.'
        : 'Enter a valid split.';
}

function previewAmounts(
  totalMinor: bigint | null,
  method: GroupExpenseMethod,
  ids: readonly string[],
  values: readonly (bigint | null)[],
): { userId: string; amountMinor: bigint | null }[] {
  if (method === 'exact')
    return ids.map((userId, index) => ({ userId, amountMinor: values[index] ?? null }));
  if (totalMinor === null || !ids.length)
    return ids.map((userId) => ({ userId, amountMinor: null }));
  if (method === 'equal')
    return allocateParticipants(totalMinor, ids, 'equal').map((share) => ({ ...share }));
  if (method === 'percentage')
    return ids.map((userId, index) => {
      const value = values[index];
      return {
        userId,
        amountMinor:
          value === null || value === undefined
            ? null
            : (totalMinor * value) / FULL_PERCENT_BASIS_POINTS,
      };
    });
  const totalShares = sum(values);
  return ids.map((userId, index) => {
    const value = values[index];
    return {
      userId,
      amountMinor:
        value === null || value === undefined || totalShares === 0n
          ? null
          : (totalMinor * value) / totalShares,
    };
  });
}

function allocationStatus(
  totalMinor: bigint | null,
  method: GroupExpenseMethod,
  ids: readonly string[],
  values: readonly (bigint | null)[],
  basis: Readonly<Record<string, string>>,
  currency: string,
): AllocationStatus {
  if (!ids.length) return { tone: 'warning', label: 'Pick who shared this', remaining: null };
  if (method === 'equal')
    return {
      tone: totalMinor === null ? 'warning' : 'positive',
      label:
        ids.length === 1 ? 'One person covers it all' : `Split evenly between ${ids.length} people`,
      remaining: null,
    };
  if (method === 'shares') {
    const totalShares = sum(values);
    return totalShares > 0n
      ? {
          tone: 'positive',
          label: `${totalShares} ${totalShares === 1n ? 'share' : 'shares'} in total`,
          remaining: null,
        }
      : { tone: 'warning', label: 'Give at least one share', remaining: null };
  }
  const filled = ids.filter((id) => (basis[id] ?? '').trim()).length;
  if (method === 'percentage') {
    const remaining = FULL_PERCENT_BASIS_POINTS - sum(values);
    if (remaining === 0n) return { tone: 'positive', label: '100% assigned', remaining };
    if (remaining < 0n)
      return { tone: 'destructive', label: `${formatBasisPoints(-remaining)}% over`, remaining };
    return {
      tone: filled ? 'destructive' : 'warning',
      label: `${formatBasisPoints(remaining)}% left to assign`,
      remaining,
    };
  }
  if (totalMinor === null)
    return { tone: 'warning', label: 'Enter the total first', remaining: null };
  const remaining = totalMinor - sum(values);
  const money = (value: bigint) => {
    try {
      return formatMinor(value, currency);
    } catch {
      return value.toString();
    }
  };
  if (remaining === 0n) return { tone: 'positive', label: 'All assigned', remaining };
  if (remaining < 0n) return { tone: 'destructive', label: `${money(-remaining)} over`, remaining };
  return {
    tone: filled ? 'destructive' : 'warning',
    label: `${money(remaining)} left to assign`,
    remaining,
  };
}

export type PayerDraftInput = {
  totalMinor: bigint | null;
  currency: string;
  payerIds: readonly string[];
  /** Amount typed per payer; only used when more than one person paid. */
  amounts: Readonly<Record<string, string>>;
};
export type PayerDraft = {
  payers: ExpenseShare[];
  allocation: AllocationStatus;
  error: string;
};

/** Who paid: one person covers the total, or several people with amounts that add up to it. */
export function computePayerDraft(input: PayerDraftInput): PayerDraft {
  const { totalMinor, payerIds, amounts, currency } = input;
  if (!payerIds.length)
    return {
      payers: [],
      allocation: { tone: 'warning', label: 'Choose who paid', remaining: null },
      error: 'Choose who paid.',
    };
  if (totalMinor === null)
    return {
      payers: [],
      allocation: { tone: 'warning', label: 'Enter the total first', remaining: null },
      error: 'Enter the total amount.',
    };
  if (payerIds.length === 1)
    return {
      payers: [{ userId: payerIds[0]!, amountMinor: totalMinor }],
      allocation: { tone: 'positive', label: 'Paid in full', remaining: 0n },
      error: '',
    };
  const values = payerIds.map((id) => parseBasisValue('exact', amounts[id], currency));
  const filled = payerIds.filter((id) => (amounts[id] ?? '').trim()).length;
  const remaining = totalMinor - sum(values);
  const money = (value: bigint) => formatMinor(value, currency);
  const allocation: AllocationStatus =
    remaining === 0n
      ? { tone: 'positive', label: 'Paid in full', remaining }
      : remaining < 0n
        ? { tone: 'destructive', label: `${money(-remaining)} over`, remaining }
        : {
            tone: filled ? 'destructive' : 'warning',
            label: `${money(remaining)} still unpaid`,
            remaining,
          };
  if (values.some((value) => value === null))
    return { payers: [], allocation, error: 'Enter how much each payer covered.' };
  if (remaining !== 0n)
    return { payers: [], allocation, error: 'Payments must add up to the total.' };
  return {
    payers: payerIds.map((userId, index) => ({ userId, amountMinor: values[index]! })),
    allocation,
    error: '',
  };
}
