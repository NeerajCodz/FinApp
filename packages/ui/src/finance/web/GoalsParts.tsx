'use client';
import React from 'react';
import { Target, Wallet, TrendingUp, Calendar, Flag, PieChart, Check } from 'lucide-react';
import { formatMinor } from '../money';
import { FinanceEmptyState } from './FinanceEmptyState';
import s from './Goals.module.css';
import { ColumnChart, DonutChart, LineChart, compactMoney, fullMoney } from '../../charts/web';
import { toMajor } from '../../analytics/chart-utils';
export const chartColors = [
  'var(--finapp-primary)',
  'var(--finapp-chart-blue)',
  'var(--finapp-chart-violet)',
  'var(--finapp-chart-yellow)',
  'var(--finapp-destructive)',
  'var(--finapp-chart-cyan)',
];
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={s.panel}>
      <div className={s.between}>
        <h2>{title}</h2>
        {action}
      </div>
      {description && <p className={s.muted}>{description}</p>}
      {children}
    </section>
  );
}
export function Metrics({
  items,
}: {
  items: readonly {
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    tone?: string;
  }[];
}) {
  const icons = [Target, Wallet, PieChart, Calendar, Flag, TrendingUp];
  return (
    <section className={s.metrics} style={{ '--metrics': items.length } as React.CSSProperties}>
      {items.map((item, i) => {
        const Icon = icons[i % icons.length]!;
        return (
          <article key={item.label} className={s.metric}>
            <span
              className={s.tile}
              style={
                {
                  '--tile': item.tone ?? chartColors[i % chartColors.length],
                } as React.CSSProperties
              }
            >
              <Icon size={23} />
            </span>
            <div>
              <div className={s.muted}>{item.label}</div>
              <div className={s.metricValue}>{item.value}</div>
              <div className={s.muted}>{item.detail}</div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
export function Bar({
  value,
  large = false,
  tone,
}: {
  value: number;
  large?: boolean;
  tone?: string;
}) {
  return (
    <div
      className={`${s.bar} ${large ? s.largeBar : ''}`}
      role="progressbar"
      aria-valuenow={Math.max(0, Math.min(100, value))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={s.barFill}
        style={
          { width: `${Math.max(0, Math.min(100, value))}%`, '--fill': tone } as React.CSSProperties
        }
      />
    </div>
  );
}
/** A donut of parts (bigint amounts) with a value and label in the middle. */
export function Ring({
  segments,
  value,
  label,
  detail,
}: {
  segments: readonly { amount: bigint; color?: string; name?: string }[];
  value: React.ReactNode;
  label: string;
  detail?: React.ReactNode;
}) {
  const total = segments.reduce(
    (sum, segment) => sum + (segment.amount > 0n ? segment.amount : 0n),
    0n,
  );
  if (total === 0n) {
    return (
      <FinanceEmptyState
        kind="analytics"
        compact
        title="Nothing to chart yet"
        description="Recorded amounts will fill this chart."
      />
    );
  }
  return (
    <div className={s.ring}>
      <DonutChart
        caption={label}
        size={150}
        legend={false}
        centerValue={typeof value === 'string' ? value : undefined}
        centerLabel={[label, typeof detail === 'string' ? detail : null]
          .filter(Boolean)
          .join(' · ')}
        items={segments.map((segment, index) => {
          const share = segment.amount > 0n ? Number((segment.amount * 1000n) / total) / 10 : 0;
          return {
            id: String(index),
            label: segment.name ?? label,
            value: share,
            display: `${share}%`,
            color: segment.color ?? chartColors[index % chartColors.length],
          };
        })}
      />
    </div>
  );
}
export function Legend({
  rows,
  currency,
}: {
  rows: readonly { name: string; amount: bigint; color?: string }[];
  currency: string;
}) {
  const total = rows.reduce((n, v) => n + v.amount, 0n);
  return rows.length ? (
    <div className={s.legend}>
      {rows.map((v, i) => (
        <div key={v.name} className={s.between}>
          <span>
            <i
              className={s.dot}
              style={{ background: v.color ?? chartColors[i % chartColors.length] }}
            />
            {v.name}
          </span>
          <span>
            {formatMinor(v.amount, currency)}{' '}
            <span className={s.muted}>{total > 0n ? Number((v.amount * 100n) / total) : 0}%</span>
          </span>
        </div>
      ))}
    </div>
  ) : (
    <FinanceEmptyState
      kind="analytics"
      compact
      title="No breakdown data yet"
      description="A breakdown will appear when matching records are available."
    />
  );
}
/** Monthly columns (stacked when rows carry segments), with an optional target line. */
export function Bars({
  rows,
  currency,
  target,
}: {
  rows: readonly {
    label: string;
    amount: bigint;
    segments?: readonly { amount: bigint; color?: string; name?: string }[];
  }[];
  currency: string;
  target?: bigint;
}) {
  if (!rows.some((r) => r.amount > 0n))
    return (
      <FinanceEmptyState
        kind="analytics"
        compact
        title="No spending to chart"
        description="Posted expenses will build this chart over time."
      />
    );
  const parts = Math.max(1, ...rows.map((r) => r.segments?.length ?? 1));
  const series = Array.from({ length: parts }, (_, index) => {
    const sample = rows.find((r) => r.segments?.[index])?.segments?.[index];
    return {
      id: String(index),
      label: sample?.name ?? (parts === 1 ? 'Amount' : `Part ${index + 1}`),
      color: sample?.color ?? chartColors[index % chartColors.length],
      values: rows.map((r) =>
        toMajor(
          r.segments ? (r.segments[index]?.amount ?? 0n) : index === 0 ? r.amount : 0n,
          currency,
        ),
      ),
    };
  });
  return (
    <ColumnChart
      caption={`Monthly amounts in ${currency}`}
      mode={parts > 1 ? 'stacked' : 'grouped'}
      height={200}
      labels={rows.map((r) => r.label)}
      series={series}
      line={
        target !== undefined
          ? {
              id: 'target',
              label: 'Required',
              values: rows.map(() => toMajor(target, currency)),
            }
          : undefined
      }
      format={(value) => fullMoney(value, currency)}
      axisFormat={(value) => compactMoney(value, currency)}
    />
  );
}
/** Savings over time as an area line, with an optional target line. */
export function Trend({
  rows,
  target,
  currency = 'INR',
}: {
  rows: readonly { label: string; amount: bigint }[];
  target?: bigint;
  currency?: string;
}) {
  if (!rows.some((r) => r.amount > 0n))
    return (
      <FinanceEmptyState
        kind="analytics"
        compact
        title="No progress history yet"
        description="Recorded contributions will shape your savings trend."
      />
    );
  return (
    <LineChart
      caption={`Savings trend in ${currency}`}
      height={200}
      labels={rows.map((r) => r.label)}
      series={[
        {
          id: 'saved',
          label: 'Saved',
          values: rows.map((r) => toMajor(r.amount, currency)),
          color: 'var(--finapp-primary)',
        },
        ...(target !== undefined
          ? [
              {
                id: 'target',
                label: 'Target',
                values: rows.map(() => toMajor(target, currency)),
                color: 'var(--finapp-foreground-muted)',
              },
            ]
          : []),
      ]}
      format={(value) => fullMoney(value, currency)}
      axisFormat={(value) => compactMoney(value, currency)}
    />
  );
}
export function Milestones({
  saved,
  target,
  currency,
  rows,
}: {
  saved: bigint;
  target: bigint;
  currency: string;
  rows?: readonly { percent: number; achievedAt?: number; projectedAt?: number }[];
}) {
  return (
    <div className={s.milestones}>
      {[25, 50, 75, 100].map((percent) => {
        const amount = (target * BigInt(percent) + 99n) / 100n;
        const done = saved >= amount && target > 0n;
        const row = rows?.find((r) => r.percent === percent);
        return (
          <div key={percent}>
            <div className={`${s.milestoneMark} ${done ? s.done : ''}`}>
              {done && <Check size={15} />}
            </div>
            <strong>{formatMinor(amount, currency)}</strong>
            <p>{percent}% complete</p>
            <span className={done ? s.positive : s.muted}>{done ? 'Completed' : 'Upcoming'}</span>
            {(row?.achievedAt ?? row?.projectedAt) !== undefined && (
              <p className={s.muted}>
                {new Date((row?.achievedAt ?? row?.projectedAt)!).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function ContributionTable({
  history,
  currency,
  accounts = [],
}: {
  history: readonly { id: string; occurredAt: number; amount: bigint; accountId?: string }[];
  currency: string;
  accounts?: readonly { id: string; name: string }[];
}) {
  return history.length ? (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Source / Account</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {[...history]
            .sort((a, b) => b.occurredAt - a.occurredAt)
            .slice(0, 8)
            .map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{new Date(r.occurredAt).toLocaleDateString()}</td>
                <td>
                  {accounts.find((a) => a.id === r.accountId)?.name ??
                    (r.accountId ? 'Unavailable account' : 'Manual contribution')}
                </td>
                <td>Recorded contribution</td>
                <td className={s.positive}>+{formatMinor(r.amount, currency)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  ) : (
    <FinanceEmptyState
      kind="contribution"
      compact
      title="No contributions yet"
      description="Every deposit toward this goal will be recorded here."
    />
  );
}
