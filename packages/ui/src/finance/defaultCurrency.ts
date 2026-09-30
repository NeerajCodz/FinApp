export type CurrencyPreferenceRecord = {
  defaultCurrency?: unknown;
  currency?: unknown;
  updatedAt?: unknown;
};

type Candidate = { value: string; updatedAt: number; priority: number };

export function resolveDefaultCurrency(
  profiles: readonly object[] = [],
  settings: readonly object[] = [],
): string | undefined {
  let best: Candidate | undefined;
  const consider = (value: unknown, updatedAt: unknown, priority: number) => {
    if (typeof value !== 'string' || !/^[a-z]{3}$/i.test(value.trim())) return;
    const timestamp = Number(updatedAt);
    const candidate: Candidate = {
      value: value.trim().toUpperCase(),
      updatedAt: Number.isFinite(timestamp) ? timestamp : 0,
      priority,
    };
    if (
      !best ||
      candidate.updatedAt > best.updatedAt ||
      (candidate.updatedAt === best.updatedAt && candidate.priority < best.priority)
    )
      best = candidate;
  };

  for (const value of profiles) {
    const profile = value as CurrencyPreferenceRecord;
    consider(profile.defaultCurrency, profile.updatedAt, 0);
  }
  for (const value of settings) {
    const setting = value as CurrencyPreferenceRecord;
    consider(setting.defaultCurrency, setting.updatedAt, 1);
    consider(setting.currency, setting.updatedAt, 2);
  }
  return best?.value;
}
