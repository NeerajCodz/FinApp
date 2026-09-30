export type DateRangePreset = { label: string; value: string };

export function calendarMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

export function shiftCalendarMonth(monthKey: string, amount: number) {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function calendarMonthDays(monthKey: string) {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }),
  ];
}

export function formatCalendarDate(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
