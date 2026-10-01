'use client';
import { Button, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetOverviewItem = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  currency: string;
  spentMinor: bigint;
  limitMinor: bigint;
  startAt: number;
  endAt: number;
};
export function BudgetOverviewScreen({
  items,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  items: readonly BudgetOverviewItem[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const { tokens: themeTokens } = useTheme();
  const tokens = { ...themeTokens, surface: themeTokens.surfaceRaised };
  return (
    <main
      style={{
        width: 'min(100%,1280px)',
        margin: '0 auto',
        padding: '28px 24px 60px',
        color: tokens.foreground,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 26,
        }}
      >
        <div>
          <Typography variant="title">Budgets</Typography>
          <p style={{ color: tokens.foregroundMuted }}>
            Monitor category limits and understand your spending.
          </p>
        </div>
        <Button onPress={onCreate}>＋ New budget</Button>
      </header>
      {loading ? (
        <p role="status">Loading your budgets…</p>
      ) : error ? (
        <p role="alert" style={{ color: tokens.destructive }}>
          {error}
        </p>
      ) : !items.length ? (
        <section style={{ padding: 24, border: `1px solid ${tokens.border}`, borderRadius: 18 }}>
          <Typography variant="bodyLarge">No category budgets yet</Typography>
          <p style={{ color: tokens.foregroundMuted }}>
            Create a budget for a category you already use. Only posted expenses in that category
            count.
          </p>
          <Button onPress={onCreate}>Create a budget</Button>
        </section>
      ) : (
        <section
          aria-label="Your category budgets"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap: 14,
          }}
        >
          {items.map((item) => {
            const ratio =
              item.limitMinor > 0n ? Number((item.spentMinor * 10000n) / item.limitMinor) / 100 : 0;
            const width = Math.min(100, ratio);
            const date = (value: number) =>
              new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(value);
            return (
              <article
                key={item.id}
                style={{
                  display: 'grid',
                  gap: 14,
                  padding: 18,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 18,
                  background: tokens.surface,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CategoryIcon label={item.category} icon={item.icon} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{item.name}</strong>
                    <div style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
                      {item.category} · {item.currency}
                    </div>
                  </div>
                  <Button variant="ghost" onPress={() => onOpen(item.id)}>
                    View
                  </Button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'baseline',
                  }}
                >
                  <strong>{formatMinor(item.spentMinor, item.currency)}</strong>
                  <span style={{ color: tokens.foregroundMuted }}>
                    of {formatMinor(item.limitMinor, item.currency)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${item.name} spending`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(ratio)}
                  style={{
                    height: 9,
                    borderRadius: 99,
                    background: tokens.surfaceRaised,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${width}%`,
                      background: ratio >= 100 ? tokens.destructive : tokens.primary,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: tokens.foregroundMuted,
                  }}
                >
                  <span>{Math.round(ratio)}% used</span>
                  <span>
                    {date(item.startAt)} – {date(item.endAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
