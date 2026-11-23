import type { LocalRecord } from '@/local/repository';

export function canEditGroupExpense(
  record: LocalRecord | undefined,
  userId: string | null,
): boolean {
  return Boolean(
    userId &&
    record &&
    record.ownerId === userId &&
    record.groupId &&
    record.type === 'expense' &&
    record.status === 'posted' &&
    record.deletedAt === undefined,
  );
}
