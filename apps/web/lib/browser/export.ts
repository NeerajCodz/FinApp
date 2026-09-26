import { zipSync, strToU8 } from 'fflate';
import { exportTables } from '../../../../convex/export/domain';
import { exportCsv } from '../../../mobile/lib/export/csv';
import type { LocalRecord } from '@/lib/offline/repository';

export type FinanceBackupTables = {
  accounts: readonly LocalRecord[];
  transactions: readonly LocalRecord[];
  categories: readonly LocalRecord[];
  groups: readonly LocalRecord[];
  settlements: readonly LocalRecord[];
};

type ZipFile = { name: string; content: string };

export function financeBackupFiles(tables: FinanceBackupTables): readonly ZipFile[] {
  const safeTables = exportTables(tables);
  return [
    { name: 'accounts.csv', content: exportCsv(safeTables.accounts ?? []) },
    { name: 'transactions.csv', content: exportCsv(safeTables.transactions ?? []) },
    { name: 'categories.csv', content: exportCsv(safeTables.categories ?? []) },
    { name: 'groups.csv', content: exportCsv(safeTables.groups ?? []) },
    { name: 'settlements.csv', content: exportCsv(safeTables.settlements ?? []) },
  ];
}

export function createZip(files: readonly ZipFile[]): Uint8Array {
  const entries = Object.fromEntries(files.map(({ name, content }) => [name, strToU8(content)]));
  return zipSync(entries, { level: 0 });
}

export function downloadFinanceBackup(tables: FinanceBackupTables, date = new Date()): void {
  const stamp = date.toISOString().slice(0, 10);
  const bytes = createZip(financeBackupFiles(tables));
  const archive = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
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
