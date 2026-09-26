import { describe, expect, it } from 'vitest';
import { createZip, financeBackupFiles } from '../../apps/web/lib/browser/export';
import type { LocalRecord } from '../../apps/web/lib/offline/repository';

function storedZipEntries(archive: Uint8Array): Map<string, string> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  const endOffset = archive.length - 22;
  if (view.getUint32(endOffset, true) !== 0x06054b50) throw new Error('INVALID_ZIP_END');
  const count = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const entries = new Map<string, string>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('INVALID_ZIP_DIRECTORY');
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    const localOffset = view.getUint32(offset + 42, true);
    if (method !== 0 || view.getUint32(localOffset, true) !== 0x04034b50)
      throw new Error('UNSUPPORTED_ZIP_ENTRY');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, decoder.decode(archive.subarray(dataOffset, dataOffset + size)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

describe('browser financial backup archive', () => {
  it('contains all five CSV tables and preserves archived and deleted records', () => {
    const tables = {
      accounts: [
        { id: 'account-1', name: 'Checking', currency: 'USD', archivedAt: 10 } as LocalRecord,
      ],
      categories: [{ id: 'category-1', name: 'Food' } as LocalRecord],
      transactions: [
        {
          id: 'transaction-1',
          title: 'Removed transaction',
          amountMinor: 123n,
          currency: 'USD',
          occurredAt: 20,
          deletedAt: 30,
        } as LocalRecord,
      ],
      budgets: [{ id: 'budget-1', name: 'Monthly' } as LocalRecord],
      goals: [{ id: 'goal-1', name: 'Emergency fund', targetAmountMinor: 500n } as LocalRecord],
    };
    const files = financeBackupFiles(tables);
    expect(files.map((file) => file.name)).toEqual([
      'accounts.csv',
      'categories.csv',
      'transactions.csv',
      'budgets.csv',
      'goals.csv',
    ]);

    const archive = storedZipEntries(createZip(files, new Date('2026-01-01T00:00:00.000Z')));
    expect([...archive.keys()]).toEqual(files.map((file) => file.name));
    expect(archive.get('accounts.csv')).toContain('account-1');
    expect(archive.get('accounts.csv')).toContain('archivedAt');
    expect(archive.get('transactions.csv')).toContain('transaction-1');
    expect(archive.get('transactions.csv')).toContain('"123"');
    expect(archive.get('transactions.csv')).toContain('""deletedAt"":30');
    expect(archive.get('goals.csv')).toContain('"500"');
  });
});
