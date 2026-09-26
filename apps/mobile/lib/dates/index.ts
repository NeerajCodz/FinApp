export function startOfLocalDay(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
}

export function periodBounds(
  timestamp: number,
  timezone: string,
  monthStart = 1,
): { start: number; end: number } {
  const dayStart = startOfLocalDay(timestamp, timezone);
  const date = new Date(dayStart);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const periodYear = date.getUTCDate() < monthStart ? year : year;
  const startMonth = date.getUTCDate() < monthStart ? month - 1 : month;
  const start = Date.UTC(periodYear, startMonth, monthStart);
  return { start, end: Date.UTC(periodYear, startMonth + 1, monthStart) };
}
