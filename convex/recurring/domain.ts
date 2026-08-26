export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export function nextOccurrence(timestamp: number, frequency: Recurrence, interval = 1): number {
  if (interval <= 0) throw new Error('INVALID_RECURRENCE');
  const date = new Date(timestamp);
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + interval);
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7 * interval);
  if (frequency === 'monthly') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + interval);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  if (frequency === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + interval);
  if (frequency === 'custom') date.setUTCDate(date.getUTCDate() + interval);
  return date.getTime();
}
