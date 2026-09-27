import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystem = vi.hoisted(() => ({
  documentDirectory: 'file:///Documents/',
  makeDirectoryAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => fileSystem);

import { writeExportBundle } from '../../apps/mobile/lib/export';

describe('native privacy data export', () => {
  beforeEach(() => {
    fileSystem.makeDirectoryAsync.mockReset();
    fileSystem.writeAsStringAsync.mockReset();
  });

  it('writes locally available records to five sanitized CSV files', async () => {
    const directory = await writeExportBundle({
      accounts: [{ name: 'Cash', secret: 'private-key' }],
      transactions: [{ title: 'Lunch', amountMinor: 1250n }],
      categories: [{ name: 'Food' }],
      groups: [{ name: 'Weekend', token: 'invite-token' }],
      settlements: [{ amountMinor: 500n, session: 'auth-session' }],
    });

    expect(directory).toBe('file:///Documents/finapp-export/');
    expect(fileSystem.makeDirectoryAsync).toHaveBeenCalledWith(directory, { intermediates: true });
    const writtenFiles = new Map(
      fileSystem.writeAsStringAsync.mock.calls.map(([path, content]) => [path, content]),
    );
    expect([...writtenFiles.keys()]).toEqual([
      `${directory}accounts.csv`,
      `${directory}transactions.csv`,
      `${directory}categories.csv`,
      `${directory}groups.csv`,
      `${directory}settlements.csv`,
    ]);
    expect(writtenFiles.get(`${directory}transactions.csv`)).toContain('Lunch');
    expect(writtenFiles.get(`${directory}transactions.csv`)).toContain('1250n');
    expect(writtenFiles.get(`${directory}accounts.csv`)).toContain('Cash');
    expect(writtenFiles.get(`${directory}accounts.csv`)).not.toContain('private-key');
    expect(writtenFiles.get(`${directory}groups.csv`)).not.toContain('invite-token');
    expect(writtenFiles.get(`${directory}settlements.csv`)).not.toContain('auth-session');
  });
});
