/**
 * Argument readers for FinAI tools. Gemini sends loosely typed JSON, so every tool reads its
 * arguments through these helpers instead of trusting the declared schema.
 */
import type { GeminiSchema } from './gemini';
import { parseMajorToMinor } from './present';

const DAY = 86_400_000;

export class ToolArgError extends Error {
  constructor(code: string) {
    super(code);
  }
}

export function str(args: Record<string, unknown>, key: string, max = 200): string | undefined {
  const value = args[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function requiredStr(args: Record<string, unknown>, key: string, max = 200): string {
  const value = str(args, key, max);
  if (!value) throw new ToolArgError(`MISSING_${key.toUpperCase()}`);
  return value;
}

export function int(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = args[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function oneOf<T extends string>(
  args: Record<string, unknown>,
  key: string,
  options: readonly T[],
): T | undefined {
  const value = args[key];
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function strList(args: Record<string, unknown>, key: string, max = 50): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((item): item is string => typeof item === 'string' && !!item.trim())),
  ].slice(0, max);
}

/** A positive decimal amount ("125.50") in a currency's minor units. */
export function amountMinor(
  args: Record<string, unknown>,
  key: string,
  currency: string,
): bigint | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const parsed =
    typeof raw === 'number' || typeof raw === 'string'
      ? parseMajorToMinor(String(raw).replace(/[,\s]/g, ''), currency)
      : null;
  if (parsed === null || parsed <= 0n) throw new ToolArgError('INVALID_AMOUNT');
  return parsed;
}

/** A `YYYY-MM-DD` date (UTC midnight) or full ISO timestamp, as epoch ms. */
export function date(args: Record<string, unknown>, key: string): number | undefined {
  const value = str(args, key, 40);
  if (!value) return undefined;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(parsed)) throw new ToolArgError(`INVALID_${key.toUpperCase()}`);
  return parsed;
}

/** A [from, to) window: `from`/`to` dates, else the last `defaultDays`, capped at 366 days. */
export function window(
  args: Record<string, unknown>,
  defaultDays: number,
  now = Date.now(),
): { startAt: number; endAt: number } {
  const to = date(args, 'to');
  const endAt =
    to !== undefined ? to + (/^\d{4}-\d{2}-\d{2}$/.test(str(args, 'to') ?? '') ? DAY : 0) : now;
  const from = date(args, 'from');
  let startAt = from ?? endAt - defaultDays * DAY;
  if (startAt >= endAt) startAt = endAt - DAY;
  if (endAt - startAt > 366 * DAY) startAt = endAt - 366 * DAY;
  return { startAt, endAt };
}

// ---------- Schema shorthands ----------

export const s = {
  object(properties: Record<string, GeminiSchema>, required: string[] = []): GeminiSchema {
    return { type: 'OBJECT', properties, ...(required.length ? { required } : {}) };
  },
  string(description: string, extra: Partial<GeminiSchema> = {}): GeminiSchema {
    return { type: 'STRING', description, ...extra };
  },
  integer(description: string, minimum?: number, maximum?: number): GeminiSchema {
    return {
      type: 'INTEGER',
      description,
      ...(minimum === undefined ? {} : { minimum }),
      ...(maximum === undefined ? {} : { maximum }),
    };
  },
  enumOf(description: string, values: string[]): GeminiSchema {
    return { type: 'STRING', description, enum: values };
  },
  ids(description: string): GeminiSchema {
    return { type: 'ARRAY', description, items: { type: 'STRING' } };
  },
  amount(description: string): GeminiSchema {
    return {
      type: 'STRING',
      description: `${description} Decimal in major units as a string, e.g. "125.50".`,
    };
  },
  date(description: string): GeminiSchema {
    return { type: 'STRING', description: `${description} Format YYYY-MM-DD.` };
  },
};
