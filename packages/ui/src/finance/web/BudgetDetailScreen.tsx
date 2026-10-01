'use client';
import { Button, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetDetailItem = {
  id: string;
  title: string;
  date: string;
  amountMinor: bigint;
  currency: string;
};
export function BudgetDetailScreen({
  name,
  category,
  icon,
  currency,
  limit,
  spent,
  transactions,
  loading,
  error,
  actionError,
  pending,
  onEdit,
  onAnalytics,
  onArchive,
  onOpenTransaction,
}: {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  spent: bigint;
  transactions: readonly BudgetDetailItem[];
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  pending?: boolean;
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
  onOpenTransaction: (id: string) => void;
}) {
  const { tokens: themeTokens } = useTheme();
  const tokens = { ...themeTokens, surface: themeTokens.surfaceRaised };
  const ratio = limit > 0n ? Number((spent * 10000n) / limit) / 100 : 0;
  const remaining = limit - spent;
  return (
    <main style={{ width: 'min(100%,1240px)', margin: '0 auto', padding: '26px 24px 64px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <CategoryIcon label={category} icon={icon} />
          <div>
            <Typography variant="title">{name}</Typography>
            <p style={{ color: tokens.foregroundMuted }}>{category} · Category budget</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onPress={onAnalytics}>
            View analytics
          </Button>
          <Button onPress={onEdit}>Edit budget</Button>
        </div>
      </header>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          ['Monthly limit', formatMinor(limit, currency)],
          ['Spent so far', formatMinor(spent, currency)],
          ['Remaining', formatMinor(remaining < 0n ? -remaining : remaining, currency)],
          ['Status', ratio >= 100 ? 'Over limit' : `${Math.round(ratio)}% used`],
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
            <div style={{ fontSize: 13, color: tokens.foregroundMuted }}>{label}</div>
            <strong>
              {label === 'Remaining' && remaining < 0n ? 'Over by ' : ''}
              {value}
            </strong>
          </article>
        ))}
      </section>
      <section
        style={{
          padding: 20,
          border: `1px solid ${tokens.border}`,
          borderRadius: 18,
          background: tokens.surface,
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="bodyLarge">Budget progress</Typography>
          <span>{Math.round(ratio)}% used</span>
        </div>
        <div
          role="progressbar"
          aria-label="Budget usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio)}
          style={{
            height: 12,
            borderRadius: 99,
            background: tokens.surfaceRaised,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, ratio)}%`,
              background: ratio >= 100 ? tokens.destructive : tokens.primary,
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{formatMinor(spent, currency)} spent</span>
          <span>{formatMinor(limit, currency)} limit</span>
        </div>
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
        <Typography variant="bodyLarge">Recent expenses</Typography>
        {loading ? (
          <p role="status">Loading saved activity…</p>
        ) : error ? (
          <p role="alert" style={{ color: tokens.destructive }}>
            {error}
          </p>
        ) : transactions.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {transactions.map((row) => (
              <li key={row.id}>
                <button
                  onClick={() => onOpenTransaction(row.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 0',
                    background: 'none',
                    border: 0,
                    borderBottom: `1px solid ${tokens.border}`,
                    color: tokens.foreground,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    {row.title}
                    <small style={{ display: 'block', color: tokens.foregroundMuted }}>
                      {row.date}
                    </small>
                  </span>
                  <strong>{formatMinor(row.amountMinor, row.currency)}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: tokens.foregroundMuted }}>
            No posted expenses for this category and budget period yet.
          </p>
        )}
      </section>
      {actionError && (
        <p role="alert" style={{ color: tokens.destructive }}>
          {actionError}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="outline" disabled={pending} onPress={onArchive}>
          {pending ? 'Archiving…' : 'Archive budget'}
        </Button>
      </div>
    </main>
  );
}
