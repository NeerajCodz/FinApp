'use client';
import { Button, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetAnalyticsTransaction = {
  id: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  title: string;
};
export function BudgetAnalyticsScreen({
  name,
  category,
  icon,
  currency,
  limit,
  transactions,
  period,
  startAt,
  endAt,
  loading,
  error,
  onPeriodChange,
  onBack,
}: {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  transactions: readonly BudgetAnalyticsTransaction[];
  period: 'week' | 'month' | 'year';
  startAt: number;
  endAt: number;
  loading?: boolean;
  error?: string | null;
  onPeriodChange: (value: 'week' | 'month' | 'year') => void;
  onBack: () => void;
}) {
  const { tokens: themeTokens } = useTheme();
  const tokens = { ...themeTokens, surface: themeTokens.surfaceRaised };
  const spent = transactions.reduce((sum, row) => sum + row.amountMinor, 0n);
  const remaining = limit - spent;
  const days = Math.max(1, Math.ceil((endAt - startAt) / 86400000));
  const buckets = Array.from({ length: Math.min(days, 31) }, (_, index) => ({
    day: index,
    amount: 0n,
  }));
  for (const row of transactions) {
    const day = Math.floor((row.occurredAt - startAt) / 86400000);
    const bucket =
      buckets[Math.min(buckets.length - 1, Math.max(0, Math.floor((day * buckets.length) / days)))];
    if (bucket) bucket.amount += row.amountMinor;
  }
  const max = buckets.reduce((m, b) => (b.amount > m ? b.amount : m), 0n) || 1n;
  return (
    <main style={{ width: 'min(100%,1280px)', margin: '0 auto', padding: '26px 24px 64px' }}>
      <Button variant="ghost" onPress={onBack}>
        ‹ Budgets
      </Button>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          margin: '20px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CategoryIcon label={category} icon={icon} />
          <div>
            <Typography variant="title">{name} analytics</Typography>
            <p style={{ color: tokens.foregroundMuted }}>
              Actual posted category expenses · {currency}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['week', 'month', 'year'] as const).map((value) => (
            <Button
              key={value}
              variant={period === value ? 'primary' : 'outline'}
              aria-pressed={period === value}
              onPress={() => onPeriodChange(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </header>
      {loading ? (
        <p role="status">Loading this budget period…</p>
      ) : error ? (
        <p role="alert" style={{ color: tokens.destructive }}>
          {error}
        </p>
      ) : (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: 12,
            }}
          >
            {[
              ['Budget limit', formatMinor(limit, currency)],
              ['Total spent', formatMinor(spent, currency)],
              [
                'Remaining',
                `${remaining < 0n ? 'Over by ' : ''}${formatMinor(remaining < 0n ? -remaining : remaining, currency)}`,
              ],
              ['Used', `${limit > 0n ? Math.round(Number((spent * 10000n) / limit) / 100) : 0}%`],
            ].map(([label, value]) => (
              <article
                key={label}
                style={{
                  padding: 18,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 16,
                  background: tokens.surface,
                }}
              >
                <small style={{ color: tokens.foregroundMuted }}>{label}</small>
                <div>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </section>
          <section
            style={{
              marginTop: 16,
              padding: 20,
              border: `1px solid ${tokens.border}`,
              borderRadius: 18,
              background: tokens.surface,
            }}
          >
            <Typography variant="bodyLarge">Spending over time</Typography>
            {transactions.length ? (
              <div
                aria-label="Daily spending chart"
                style={{ height: 200, display: 'flex', alignItems: 'end', gap: 4, paddingTop: 20 }}
              >
                {buckets.map((bucket, index) => (
                  <div
                    key={index}
                    title={formatMinor(bucket.amount, currency)}
                    style={{
                      flex: 1,
                      minWidth: 3,
                      height: `${Math.max(3, Number((bucket.amount * 100n) / max))}%`,
                      background: tokens.primary,
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: tokens.foregroundMuted }}>
                No posted expenses in this date range.
              </p>
            )}
          </section>
          <section
            style={{
              marginTop: 16,
              padding: 20,
              border: `1px solid ${tokens.border}`,
              borderRadius: 18,
              background: tokens.surface,
            }}
          >
            <Typography variant="bodyLarge">Category expenses</Typography>
            {transactions.length ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {transactions
                  .slice()
                  .sort((a, b) => b.occurredAt - a.occurredAt)
                  .map((row) => (
                    <li
                      key={row.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 0',
                        borderBottom: `1px solid ${tokens.border}`,
                      }}
                    >
                      <span>
                        {row.title}
                        <small style={{ display: 'block', color: tokens.foregroundMuted }}>
                          {new Intl.DateTimeFormat(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(row.occurredAt)}
                        </small>
                      </span>
                      <strong>{formatMinor(row.amountMinor, row.currency)}</strong>
                    </li>
                  ))}
              </ul>
            ) : (
              <p style={{ color: tokens.foregroundMuted }}>
                No posted category expenses in this period.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
