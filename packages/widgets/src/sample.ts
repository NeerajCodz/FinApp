/**
 * Deterministic, fictional sample data for widget examples (gallery, previews, tests). Server-side
 * only: renders never import from here.
 */
export const DAY = 86_400_000;
/** A fixed "now" so samples render identically everywhere. */
export const NOW = Date.UTC(2026, 10, 26, 10, 30);
export const CUR = 'INR';

export const daysAgo = (days: number, hour = 10) =>
  Date.UTC(2026, 10, 26 - days, hour, (days * 17) % 60);
export const daysAhead = (days: number) => daysAgo(-days);

/** A seeded pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` values around `base` (± `spread` fraction), rounded to whole units of `unit`. */
export function series(n: number, base: number, spread = 0.35, seed = 1, unit = 100): number[] {
  const next = rng(seed);
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      0,
      Math.round((base * (1 + (next() * 2 - 1) * spread + Math.sin(i / 2) * spread * 0.3)) / unit) *
        unit,
    ),
  );
}

/** A drifting cumulative series (balances, net worth). */
export function walk(n: number, start: number, drift: number, noise: number, seed = 2): number[] {
  const next = rng(seed);
  let value = start;
  return Array.from({ length: n }, () => {
    value += drift + (next() * 2 - 1) * noise;
    return Math.round(value / 100) * 100;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The last `n` month labels ending with Nov 2026. */
export function monthLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => MONTHS[(10 - (n - 1 - i) + 120) % 12]!);
}
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function dayLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String(((26 - (n - 1 - i) - 1 + 300) % 30) + 1));
}

export const CATEGORIES = [
  { name: 'Food & dining', icon: '🍜' },
  { name: 'Groceries', icon: '🛒' },
  { name: 'Transport', icon: '🚕' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Bills & utilities', icon: '💡' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Health', icon: '💊' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Education', icon: '📚' },
  { name: 'Gifts', icon: '🎁' },
];

export const MERCHANTS = [
  'Swiggy',
  'BigBasket',
  'Uber',
  'Amazon',
  'Blue Tokai',
  'Zomato',
  'Netflix',
  'Airtel',
  'Decathlon',
  'Apollo Pharmacy',
  'IndiGo',
  'PVR Cinemas',
];

export const PEOPLE = [
  'Aarav Shah',
  'Meera Iyer',
  'Kabir Rao',
  'Diya Menon',
  'Rohan Gupta',
  'Ananya Das',
];
