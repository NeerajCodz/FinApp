/**
 * Bulk import of transactions from a spreadsheet attachment. The model only describes the
 * columns (`ImportMapping`); every row is parsed here, exactly, so hundreds of rows never pass
 * through the model and amounts are never re-typed. Rows that can't be read are reported with
 * their sheet row number instead of being guessed.
 */
import { currencyDigits } from './present';
import type { Sheet } from './spreadsheet';
import { excelSerialToIso } from './spreadsheet';

export const MAX_IMPORT_ROWS = 1_000;

export type ImportMapping = {
  /** 1-based sheet row holding the headers (default: the first non-empty row). */
  headerRow?: number;
  /** Column header (or letter, e.g. "A") for each field. */
  date: string;
  description?: string;
  /** One signed amount column… */
  amount?: string;
  /** …or separate money-out / money-in columns. */
  debit?: string;
  credit?: string;
  /** A column saying income/expense, credit/debit, CR/DR, deposit/withdrawal. */
  type?: string;
  category?: string;
  merchant?: string;
  note?: string;
  dateFormat?: 'auto' | 'DMY' | 'MDY' | 'YMD';
  /**
   * How to read a single amount column without a type column. Default `auto`: negatives are
   * expenses and positives income when the column has negatives, otherwise all expenses.
   */
  amountSign?: 'auto' | 'negativeIsExpense' | 'allExpense' | 'allIncome';
};

export type ImportRow = {
  /** 1-based sheet row. */
  row: number;
  occurredAt: number;
  type: 'income' | 'expense';
  amountMinor: string;
  title: string;
  category?: string;
  merchant?: string;
  note?: string;
};

export type ImportResult = {
  rows: ImportRow[];
  skipped: { row: number; reason: string }[];
  headers: string[];
  /** Rows beyond MAX_IMPORT_ROWS that were left out. */
  overflow: number;
};

// ---------- Amounts ----------

type ParsedAmount = { minor: bigint; negative: boolean; hint?: 'income' | 'expense' };

/** "₹1,23,456.50", "(45.00)", "1.234,56 €", "-12", "300 CR", "45.10-" → exact minor units. */
export function parseAmount(input: string, currency: string): ParsedAmount | null {
  let text = input.trim();
  if (!text) return null;
  let hint: ParsedAmount['hint'];
  const suffix = /\s*\b(CR|DR|Cr|Dr|cr|dr)\.?$/.exec(text);
  if (suffix) {
    hint = suffix[1]!.toLowerCase() === 'cr' ? 'income' : 'expense';
    text = text.slice(0, suffix.index);
  }
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[A-Za-z]{3}|[^\d.,+\-]/g, '');
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) text = text.slice(1);
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let integer = text;
  let fraction = '';
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal separator.
    const decimal = lastDot > lastComma ? '.' : ',';
    const at = Math.max(lastDot, lastComma);
    integer = text.slice(0, at);
    fraction = text.slice(at + 1);
    if (decimal === ',' && integer.includes(',')) return null;
  } else if (lastComma >= 0) {
    const after = text.length - lastComma - 1;
    // "12,5" / "12,50" use a decimal comma; "1,234" groups thousands.
    if ((after === 1 || after === 2) && text.indexOf(',') === lastComma) {
      integer = text.slice(0, lastComma);
      fraction = text.slice(lastComma + 1);
    }
  } else if (lastDot >= 0) {
    const dots = text.split('.').length - 1;
    if (dots === 1) {
      integer = text.slice(0, lastDot);
      fraction = text.slice(lastDot + 1);
    }
    // Several dots ("1.234.567") group thousands.
  }
  integer = integer.replace(/[.,]/g, '');
  if (!/^\d{1,15}$/.test(integer || '0') || !/^\d*$/.test(fraction)) return null;
  const digits = currencyDigits(currency);
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null;
  const padded = fraction.slice(0, digits).padEnd(digits, '0');
  const minor =
    BigInt(integer || '0') * 10n ** BigInt(digits) + (digits ? BigInt(padded || '0') : 0n);
  return { minor, negative, ...(hint ? { hint } : {}) };
}

// ---------- Dates ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

type DateParts = { a: number; b: number; year: number } | { y: number; m: number; d: number };

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

function fullYear(year: number): number {
  return year < 100 ? (year < 70 ? 2000 + year : 1900 + year) : year;
}

/** Splits a date cell into parts; numeric D/M ambiguity is left to the format. */
function dateParts(input: string): DateParts | null {
  const text = input.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) return { y: +match[1]!, m: +match[2]!, d: +match[3]! };
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(text);
  if (match) return { a: +match[1]!, b: +match[2]!, year: fullYear(+match[3]!) };
  match = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s-,]+(\d{2}|\d{4})$/.exec(text);
  if (match && monthIndex(match[2]!) > 0)
    return { y: fullYear(+match[3]!), m: monthIndex(match[2]!), d: +match[1]! };
  match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/.exec(text);
  if (match && monthIndex(match[1]!) > 0)
    return { y: fullYear(+match[3]!), m: monthIndex(match[1]!), d: +match[2]! };
  // A bare Excel serial (a date column formatted as General).
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const iso = excelSerialToIso(Number(text));
    if (iso) return dateParts(iso);
  }
  return null;
}

/** DMY or MDY for ambiguous numeric dates, decided by the values themselves. */
export function detectDateFormat(cells: string[], preferMdy: boolean): 'DMY' | 'MDY' {
  for (const cell of cells) {
    const parts = dateParts(cell);
    if (!parts || !('a' in parts)) continue;
    if (parts.a > 12) return 'DMY';
    if (parts.b > 12) return 'MDY';
  }
  return preferMdy ? 'MDY' : 'DMY';
}

/** A date cell as a timestamp at 12:00 UTC (the same calendar day in nearly every zone). */
export function parseDate(input: string, format: 'DMY' | 'MDY' | 'YMD'): number | null {
  const parts = dateParts(input);
  if (!parts) return null;
  const { y, m, d } =
    'a' in parts
      ? format === 'MDY'
        ? { y: parts.year, m: parts.a, d: parts.b }
        : { y: parts.year, m: parts.b, d: parts.a }
      : parts;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  const at = Date.UTC(y, m - 1, d, 12);
  return new Date(at).getUTCDate() === d ? at : null;
}

// ---------- Rows ----------

function typeFromText(value: string): 'income' | 'expense' | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/^(income|credit|cr|deposit|in|received|refund|salary|inflow)\b/.test(text)) return 'income';
  if (/^(expense|debit|dr|withdrawal|out|paid|payment|spent|outflow|purchase)\b/.test(text))
    return 'expense';
  return null;
}

/** Index of a column by header (case/space-insensitive) or by letter ("A", "AB"). */
export function resolveColumn(headers: string[], ref: string | undefined): number | null {
  if (!ref) return null;
  const wanted = ref.trim().toLowerCase().replace(/\s+/g, ' ');
  const byName = headers.findIndex(
    (header) => header.trim().toLowerCase().replace(/\s+/g, ' ') === wanted,
  );
  if (byName >= 0) return byName;
  if (/^[A-Za-z]{1,2}$/.test(ref.trim())) {
    let index = 0;
    for (const char of ref.trim().toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
    return index - 1 < headers.length ? index - 1 : null;
  }
  return null;
}

/** Maps a sheet to transactions. Throws `IMPORT_COLUMN_NOT_FOUND:<field>` for a bad mapping. */
export function mapImportRows(
  sheet: Sheet,
  mapping: ImportMapping,
  options: { currency: string; preferMdy?: boolean },
): ImportResult {
  const headerIndex =
    mapping.headerRow && mapping.headerRow >= 1
      ? mapping.headerRow - 1
      : sheet.rows.findIndex((row) => row.some((cell) => cell !== ''));
  const headers = (sheet.rows[headerIndex] ?? []).map((cell) => cell.trim());
  const column = (field: keyof ImportMapping, required = false) => {
    const ref = mapping[field] as string | undefined;
    const index = resolveColumn(headers, ref);
    if (ref && index === null) throw new Error(`IMPORT_COLUMN_NOT_FOUND:${field}`);
    if (required && index === null) throw new Error(`IMPORT_COLUMN_NOT_FOUND:${field}`);
    return index;
  };
  const dateCol = column('date', true)!;
  const amountCol = column('amount');
  const debitCol = column('debit');
  const creditCol = column('credit');
  if (amountCol === null && debitCol === null && creditCol === null)
    throw new Error('IMPORT_COLUMN_NOT_FOUND:amount');
  const typeCol = column('type');
  const descriptionCol = column('description');
  const categoryCol = column('category');
  const merchantCol = column('merchant');
  const noteCol = column('note');

  const body = sheet.rows
    .map((cells, index) => ({ cells, row: index + 1 }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((cell) => cell !== ''));
  const format =
    mapping.dateFormat && mapping.dateFormat !== 'auto'
      ? mapping.dateFormat
      : detectDateFormat(
          body.map(({ cells }) => cells[dateCol] ?? ''),
          options.preferMdy ?? false,
        );
  let sign = mapping.amountSign ?? 'auto';
  if (sign === 'auto' && amountCol !== null) {
    const anyNegative = body.some(
      ({ cells }) => parseAmount(cells[amountCol] ?? '', options.currency)?.negative,
    );
    sign = anyNegative ? 'negativeIsExpense' : 'allExpense';
  }

  const rows: ImportRow[] = [];
  const skipped: ImportResult['skipped'] = [];
  let overflow = 0;
  for (const { cells, row } of body) {
    const cell = (index: number | null) => (index === null ? '' : (cells[index] ?? '').trim());
    const occurredAt = parseDate(cell(dateCol), format);
    if (occurredAt === null) {
      skipped.push({ row, reason: `Unreadable date “${cell(dateCol).slice(0, 40)}”` });
      continue;
    }
    let amount: ParsedAmount | null = null;
    let type: 'income' | 'expense' | null = null;
    if (debitCol !== null || creditCol !== null) {
      const debit = parseAmount(cell(debitCol), options.currency);
      const credit = parseAmount(cell(creditCol), options.currency);
      if (debit && debit.minor > 0n) [amount, type] = [debit, 'expense'];
      else if (credit && credit.minor > 0n) [amount, type] = [credit, 'income'];
    }
    if (!amount && amountCol !== null) {
      amount = parseAmount(cell(amountCol), options.currency);
      if (amount) {
        type =
          typeFromText(cell(typeCol)) ??
          amount.hint ??
          (sign === 'allIncome'
            ? 'income'
            : sign === 'allExpense'
              ? 'expense'
              : amount.negative
                ? 'expense'
                : 'income');
      }
    }
    if (!amount || !type) {
      skipped.push({ row, reason: 'No readable amount' });
      continue;
    }
    if (amount.minor === 0n) {
      skipped.push({ row, reason: 'Amount is zero' });
      continue;
    }
    if (rows.length >= MAX_IMPORT_ROWS) {
      overflow++;
      continue;
    }
    const description = cell(descriptionCol);
    const merchant = cell(merchantCol);
    rows.push({
      row,
      occurredAt,
      type,
      amountMinor: amount.minor.toString(),
      title: (description || merchant || 'Imported transaction').slice(0, 120),
      ...(cell(categoryCol) ? { category: cell(categoryCol).slice(0, 60) } : {}),
      ...(merchant ? { merchant: merchant.slice(0, 120) } : {}),
      ...(cell(noteCol) ? { note: cell(noteCol).slice(0, 500) } : {}),
    });
  }
  return { rows, skipped, headers, overflow };
}
