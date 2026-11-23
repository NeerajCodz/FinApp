export function canEditGroupExpense(
  transaction: {
    groupId?: string;
    ownerId?: string;
    type?: string;
    status?: string;
    deletedAt?: number;
  },
  userId: string | null,
): boolean {
  return Boolean(
    userId &&
    transaction.groupId &&
    transaction.ownerId === userId &&
    transaction.type === 'expense' &&
    transaction.status === 'posted' &&
    transaction.deletedAt === undefined,
  );
}
