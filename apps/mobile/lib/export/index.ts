import * as FileSystem from 'expo-file-system/legacy';
import { exportTables } from '../../../../convex/export/domain';
import { exportCsv } from './csv';
export type ExportTables = {
  transactions: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  settlements: Record<string, unknown>[];
};

export async function writeExportBundle(tables: ExportTables): Promise<string> {
  const directory = `${FileSystem.documentDirectory ?? ''}finapp-export/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeTables = exportTables(tables);
  const tableOrder = ['accounts', 'transactions', 'categories', 'groups', 'settlements'] as const;
  for (const name of tableOrder)
    await FileSystem.writeAsStringAsync(
      `${directory}${name}.csv`,
      exportCsv(safeTables[name] ?? []),
    );
  return directory;
}
