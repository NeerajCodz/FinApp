import * as FileSystem from 'expo-file-system/legacy';
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
  for (const [name, rows] of Object.entries(tables))
    await FileSystem.writeAsStringAsync(`${directory}${name}.csv`, exportCsv(rows));
  return directory;
}
