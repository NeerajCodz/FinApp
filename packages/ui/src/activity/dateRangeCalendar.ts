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

export const defaultDateRangePresets: readonly DateRangePreset[] = [
  { label: 'This week', value: 'range:this-week' },
  { label: 'Today', value: 'range:today' },
  { label: 'This month', value: 'range:this-month' },
  { label: 'Last month', value: 'range:last-month' },
  { label: 'Last 3 months', value: 'range:last-three-months' },
  { label: 'This year', value: 'range:this-year' },
];

export function localCalendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDateRangePreset(
  value: string,
  referenceDate = new Date(),
): { startDate: string; endDate: string } | undefined {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const year = today.getFullYear();
  const month = today.getMonth();
  let start: Date;

  switch (value) {
    case 'range:today':
      start = today;
      break;
    case 'range:this-week':
      start = new Date(year, month, today.getDate() - ((today.getDay() + 6) % 7));
      break;
    case 'range:this-month':
      start = new Date(year, month, 1);
      break;
    case 'range:last-month':
      start = new Date(year, month - 1, 1);
      return {
        startDate: localCalendarDateKey(start),
        endDate: localCalendarDateKey(new Date(year, month, 0)),
      };
    case 'range:last-three-months':
      start = new Date(year, month - 2, 1);
      break;
    case 'range:this-year':
      start = new Date(year, 0, 1);
      break;
    default:
      return undefined;
  }

  return { startDate: localCalendarDateKey(start), endDate: localCalendarDateKey(today) };
}
