/**
 * Whether the viewer may edit or delete a group expense: its creator, or a group owner/admin.
 * Mirrors the server rule in groups.mutations.updateExpense / deleteExpense.
 */
export function canEditGroupExpense(
  transaction: Readonly<Record<string, unknown>> & {
    groupId?: unknown;
    ownerId?: unknown;
    type?: unknown;
    status?: unknown;
    deletedAt?: unknown;
  },
  userId: string | null,
  role?: unknown,
): boolean {
  return Boolean(
    userId &&
    transaction.groupId &&
    (transaction.ownerId === userId || role === 'owner' || role === 'admin') &&
    transaction.type === 'expense' &&
    transaction.status === 'posted' &&
    transaction.deletedAt === undefined,
  );
}
