import type { LocalRecord } from '@/lib/offline/repository';

function csvCell(value: unknown): string {
  let text = typeof value === 'bigint' ? value.toString() : value == null ? '' : String(value);
  if (typeof value === 'string' && /^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function recordId(record: LocalRecord | undefined): string {
  return record ? String(record.id ?? record._id ?? '') : '';
}

export function transactionsCsv(
  transactions: readonly LocalRecord[],
  accounts: readonly LocalRecord[],
  categories: readonly LocalRecord[],
): string {
  const accountsById = new Map(
    accounts.map((account) => [recordId(account), String(account.name ?? '')]),
  );
  const categoriesById = new Map(
    categories.map((category) => [recordId(category), String(category.name ?? '')]),
  );
  const ordered = [...transactions]
    .filter((transaction) => transaction.deletedAt === undefined)
    .sort((left, right) => Number(left.occurredAt ?? 0) - Number(right.occurredAt ?? 0));
  return createCsv(
    ['Date', 'Type', 'Title', 'Amount (minor units)', 'Currency', 'Account', 'Category', 'Note'],
    ordered.map((transaction) => {
      const occurredAt = Number(transaction.occurredAt ?? NaN);
      const date = Number.isFinite(occurredAt) ? new Date(occurredAt).toISOString() : '';
      return [
        date,
        transaction.type,
        transaction.title,
        transaction.amountMinor,
        transaction.currency,
        accountsById.get(String(transaction.accountId ?? '')) ?? '',
        categoriesById.get(String(transaction.categoryId ?? '')) ?? '',
        transaction.note,
      ];
    }),
  );
}

export function accountsCsv(accounts: readonly LocalRecord[]): string {
  const ordered = [...accounts]
    .filter((account) => account.archivedAt === undefined)
    .sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? '')));
  return createCsv(
    [
      'Name',
      'Type',
      'Currency',
      'Opening balance (minor units)',
      'Current balance (minor units)',
      'Included in total',
    ],
    ordered.map((account) => [
      account.name,
      account.customType ?? account.type,
      account.currency,
      account.openingBalanceMinor,
      account.balanceMinor ?? account.openingBalanceMinor,
      account.isIncludedInTotal !== false,
    ]),
  );
}
