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
type BackupTables = {
  accounts: readonly LocalRecord[];
  categories: readonly LocalRecord[];
  transactions: readonly LocalRecord[];
  budgets: readonly LocalRecord[];
  goals: readonly LocalRecord[];
};

function tableCsv(
  records: readonly LocalRecord[],
  fields: readonly (readonly [string, string])[],
): string {
  return createCsv(
    ['Local ID', 'Cloud ID', ...fields.map(([label]) => label), 'Record JSON'],
    records.map((record) => [
      recordId(record),
      record.cloudId,
      ...fields.map(([, key]) => record[key]),
      JSON.stringify(record, (_, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ]),
  );
}

function sorted(records: readonly LocalRecord[], field: string): LocalRecord[] {
  return [...records].sort((left, right) =>
    String(left[field] ?? '').localeCompare(String(right[field] ?? '')),
  );
}

export function financeBackupFiles(
  tables: BackupTables,
): readonly { name: string; content: string }[] {
  return [
    {
      name: 'accounts.csv',
      content: tableCsv(sorted(tables.accounts, 'name'), [
        ['Name', 'name'],
        ['Type', 'type'],
        ['Custom type', 'customType'],
        ['Currency', 'currency'],
        ['Opening balance (minor units)', 'openingBalanceMinor'],
        ['Current balance (minor units)', 'balanceMinor'],
        ['Included in total', 'isIncludedInTotal'],
        ['Archived at', 'archivedAt'],
      ]),
    },
    {
      name: 'categories.csv',
      content: tableCsv(sorted(tables.categories, 'name'), [
        ['Name', 'name'],
        ['Icon', 'icon'],
        ['Color', 'color'],
        ['Sort order', 'sortOrder'],
        ['Monthly limit (minor units)', 'monthlyLimitMinor'],
        ['Limit currency', 'limitCurrency'],
        ['Archived at', 'archivedAt'],
      ]),
    },
    {
      name: 'transactions.csv',
      content: tableCsv(sorted(tables.transactions, 'occurredAt'), [
        ['Date', 'occurredAt'],
        ['Type', 'type'],
        ['Title', 'title'],
        ['Amount (minor units)', 'amountMinor'],
        ['Currency', 'currency'],
        ['Account ID', 'accountId'],
        ['Transfer account ID', 'transferAccountId'],
        ['Category ID', 'categoryId'],
        ['Group ID', 'groupId'],
        ['Status', 'status'],
        ['Note', 'note'],
        ['Deleted at', 'deletedAt'],
      ]),
    },
    {
      name: 'budgets.csv',
      content: tableCsv(sorted(tables.budgets, 'name'), [
        ['Name', 'name'],
        ['Period', 'period'],
        ['Amount (minor units)', 'amountMinor'],
        ['Currency', 'currency'],
        ['Account ID', 'accountId'],
        ['Category ID', 'categoryId'],
        ['Start at', 'startAt'],
        ['End at', 'endAt'],
        ['Archived at', 'archivedAt'],
      ]),
    },
    {
      name: 'goals.csv',
      content: tableCsv(sorted(tables.goals, 'name'), [
        ['Name', 'name'],
        ['Target amount (minor units)', 'targetAmountMinor'],
        ['Currency', 'currency'],
        ['Target date', 'targetAt'],
        ['Completed at', 'completedAt'],
        ['Archived at', 'archivedAt'],
      ]),
    },
  ];
}

type ZipFile = { name: string; content: string };
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date: Date): readonly [number, number] {
  return [
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  ];
}

export function createZip(files: readonly ZipFile[], date = new Date()): Uint8Array {
  if (files.length > 0xffff) throw new Error('ZIP_TOO_MANY_FILES');
  const [time, day] = dosTimestamp(date);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const contents = encoder.encode(file.content);
    const checksum = crc32(contents);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contents.length, true);
    localView.setUint32(22, contents.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, day, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contents.length, true);
    centralView.setUint32(24, contents.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);

    localParts.push(local, contents);
    centralParts.push(central);
    localOffset += local.length + contents.length;
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  const result = new Uint8Array(localOffset + centralSize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function downloadFinanceBackup(tables: BackupTables, date = new Date()): void {
  const stamp = date.toISOString().slice(0, 10);
  const archiveBytes = createZip(financeBackupFiles(tables), date);
  const archive = new Blob([archiveBytes.buffer as ArrayBuffer], {
    type: 'application/zip',
  });
  const url = URL.createObjectURL(archive);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `finapp-backup-${stamp}.zip`;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
