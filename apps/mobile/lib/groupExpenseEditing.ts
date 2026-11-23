import type { LocalRecord } from '@/local/repository';

/**
 * Whether the viewer may edit or delete a group expense: its creator, or a group owner/admin.
 * Mirrors the server rule in groups.mutations.updateExpense / deleteExpense.
 */
export function canEditGroupExpense(
  record: LocalRecord | undefined,
  userId: string | null,
  role?: unknown,
): boolean {
  return Boolean(
    userId &&
    record &&
    (record.ownerId === userId || role === 'owner' || role === 'admin') &&
    record.groupId &&
    record.type === 'expense' &&
    record.status === 'posted' &&
    record.deletedAt === undefined,
  );
}
