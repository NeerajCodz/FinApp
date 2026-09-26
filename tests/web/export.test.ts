import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createZip, financeBackupFiles } from '../../apps/web/lib/browser/export';
import type { LocalRecord } from '../../apps/web/lib/offline/repository';

const archiveEntries = (files: readonly { name: string; content: string }[]) => {
  const archive = unzipSync(createZip(files));
  return new Map(Object.entries(archive).map(([name, bytes]) => [name, strFromU8(bytes)]));
};

describe('browser financial backup archive', () => {
  it('exports the five planned tables and preserves local records safely', () => {
    const tables = {
      accounts: [
        {
          id: 'account-1',
          cloudId: 'cloud-account-1',
          name: 'Cash',
          archivedAt: 10,
          secret: 'never-export-this',
        },
      ],
      transactions: [
        {
          id: 'transaction-1',
          title: 'Removed transaction',
          amountMinor: 123n,
          externalReference: '00125',
          deletedAt: 30,
        },
      ],
      categories: [{ id: 'category-1', name: 'Travel' }],
      groups: [{ id: 'group-1', name: 'Weekend', token: 'never-export-this' }],
      settlements: [{ id: 'settlement-1', amountMinor: 500n, session: 'never-export-this' }],
    } satisfies Record<string, LocalRecord[]>;

    const files = financeBackupFiles(tables);
    const expectedNames = [
      'accounts.csv',
      'transactions.csv',
      'categories.csv',
      'groups.csv',
      'settlements.csv',
    ];
    expect(files.map((file) => file.name)).toEqual(expectedNames);

    const archive = archiveEntries(files);
    expect([...archive.keys()]).toEqual(expectedNames);
    expect(archive.get('accounts.csv')).toContain('account-1');
    expect(archive.get('accounts.csv')).toContain('archivedAt');
    expect(archive.get('accounts.csv')).not.toContain('never-export-this');
    expect(archive.get('transactions.csv')).toContain('transaction-1');
    expect(archive.get('transactions.csv')).toContain('123n');
    expect(archive.get('transactions.csv')).toContain('00125');
    expect(archive.get('transactions.csv')).toContain('deletedAt');
    expect(archive.get('groups.csv')).toContain('group-1');
    expect(archive.get('groups.csv')).not.toContain('never-export-this');
    expect(archive.get('settlements.csv')).toContain('settlement-1');
    expect(archive.get('settlements.csv')).toContain('500n');
    expect(archive.get('settlements.csv')).not.toContain('never-export-this');
  });
});
