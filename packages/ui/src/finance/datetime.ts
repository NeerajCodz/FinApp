export function formatTransactionDate(
  occurredAt: number,
  hasTime?: boolean,
  timeZone?: string,
): string {
  const includeTime = hasTime === true;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
    ...(timeZone ? { timeZone } : {}),
  }).format(occurredAt);
}
