/**
 * Turns Convex error codes (which arrive wrapped in request metadata, e.g.
 * "[CONVEX M(groups/mutations:updateExpense)] ... Uncaught Error: TRANSACTION_CHANGED") into
 * sentences people can act on. Pure, so the sync engines and screens on both platforms share it.
 */
const messages = {
  TRANSACTION_CHANGED:
    'Someone else changed this expense. Review the latest version and try again.',
  INSUFFICIENT_PERMISSION: 'You no longer have permission to make this change.',
  SETTLEMENT_EXCEEDS_BALANCE: 'This payment is more than what is currently owed.',
  OUTSTANDING_BALANCE: 'Settle the outstanding balance in this group first.',
  NOT_MEMBER: 'You are no longer a member of this group.',
  INVALID_SPLIT: 'The split no longer adds up to the total.',
  GROUP_ARCHIVED: 'This group was archived, so it can no longer change.',
  GROUP_UNAVAILABLE: 'This group is no longer available.',
  CURRENCY_MISMATCH: 'The account currency does not match the group currency.',
  INVALID_CATEGORY: 'That category is no longer available.',
  AUTH_REQUIRED: 'Sign in again to sync this change.',
} as const;

export type KnownSyncErrorCode = keyof typeof messages;

/** Finds a known error code anywhere in an error or message. */
export function syncErrorCode(error: unknown): KnownSyncErrorCode | null {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '');
  for (const code of Object.keys(messages) as KnownSyncErrorCode[])
    if (new RegExp(`\\b${code}\\b`).test(text)) return code;
  return null;
}

/** A readable sentence for a sync or mutation failure, or `fallback` for unknown errors. */
export function describeSyncError(
  error: unknown,
  fallback = 'This change could not sync.',
): string {
  const code = syncErrorCode(error);
  return code ? messages[code] : fallback;
}

/**
 * The text stored as an outbox entry's lastError: readable for known codes, otherwise the raw
 * message (single line, bounded) so diagnostics are not lost.
 */
export function outboxErrorText(error: unknown): string {
  const code = syncErrorCode(error);
  if (code) return messages[code];
  const raw = error instanceof Error ? error.message : 'SYNC_FAILED';
  return raw.replace(/[\r\n]+/g, ' ').slice(0, 240);
}
