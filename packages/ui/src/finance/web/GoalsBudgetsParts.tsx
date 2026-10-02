'use client';
import React from 'react';
import { Target, Wallet, TrendingUp, Calendar, Flag, PieChart, Check } from 'lucide-react';
import { formatMinor } from '../money';
import { FinanceEmptyState } from './FinanceEmptyState';
import s from './GoalsBudgets.module.css';
export const chartColors = [
  'var(--finapp-primary)',
  '#33b8ee',
  '#b18aff',
  '#ffbd45',
  'var(--finapp-destructive)',
  '#89939d',
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
export function Ring({
  segments,
  value,
  label,
  detail,
}: {
  segments: readonly { amount: bigint; color?: string }[];
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

  let offset = 0;
  return (
    <div className={s.ring}>
      <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        <circle
          cx="60"
          cy="60"
          r="49"
          fill="none"
          stroke="var(--finapp-surface-raised)"
          strokeWidth="14"
        />
        {segments.map((segment, index) => {
          const share = Number((segment.amount * 10000n) / total) / 100;
          const start = offset;
          offset += share;
          return (
            <circle
              key={index}
              cx="60"
              cy="60"
              r="49"
              fill="none"
              stroke={segment.color ?? chartColors[index % chartColors.length]}
              strokeWidth="14"
              pathLength="100"
              strokeDasharray={`${share} ${100 - share}`}
              strokeDashoffset={-start}
            />
          );
        })}
      </svg>
      <div className={s.ringCenter}>
        <strong>{value}</strong>
        <span className={s.muted}>{label}</span>
        {detail && <span className={s.positive}>{detail}</span>}
      </div>
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
export function Bars({
  rows,
  currency,
  target,
}: {
  rows: readonly {
    label: string;
    amount: bigint;
    segments?: readonly { amount: bigint; color?: string }[];
  }[];
  currency: string;
  target?: bigint;
}) {
  const max = rows.reduce((m, r) => (r.amount > m ? r.amount : m), target ?? 0n) || 1n;
  return (
    <>
      {rows.some((r) => r.amount > 0n) ? (
        <>
          <div className={s.chart}>
            <div className={s.bars}>
              {rows.map((r) => (
                <div
                  key={r.label}
                  className={s.barColumn}
                  title={`${r.label}: ${formatMinor(r.amount, currency)}`}
                >
                  {(r.segments ?? [{ amount: r.amount }]).map((v, i) => (
                    <div
                      key={i}
                      className={s.barSegment}
                      style={{
                        height: `${Number((v.amount * 10000n) / max) / 100}%`,
                        background: v.color ?? chartColors[i % chartColors.length],
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={s.axis}>
            {rows.map((r) => (
              <span key={r.label}>{r.label}</span>
            ))}
          </div>
        </>
      ) : (
        <FinanceEmptyState
          kind="analytics"
          compact
          title="No spending to chart"
          description="Posted expenses will build this chart over time."
        />
      )}
    </>
  );
}
export function Trend({
  rows,
  target,
}: {
  rows: readonly { label: string; amount: bigint }[];
  target?: bigint;
}) {
  const max = rows.reduce((m, r) => (r.amount > m ? r.amount : m), target ?? 0n) || 1n;
  const points = rows.map(
    (r, i) =>
      `${rows.length > 1 ? (i * 100) / (rows.length - 1) : 0},${95 - Number((r.amount * 9000n) / max) / 100}`,
  );
  return (
    <>
      {rows.some((r) => r.amount > 0n) ? (
        <>
          <div className={s.chart}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Savings and spending trend"
            >
              {target !== undefined && (
                <line
                  x1="0"
                  x2="100"
                  y1={95 - Number((target * 9000n) / max) / 100}
                  y2={95 - Number((target * 9000n) / max) / 100}
                  stroke="var(--finapp-foreground-muted)"
                  strokeDasharray="2 2"
                  strokeWidth=".6"
                />
              )}
              <polygon
                points={`0,100 ${points.join(' ')} 100,100`}
                fill="var(--finapp-primary)"
                opacity=".13"
              />
              <polyline
                points={points.join(' ')}
                fill="none"
                stroke="var(--finapp-primary)"
                strokeWidth="1.1"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((p, i) => {
                const [x, y] = p.split(',');
                return <circle key={i} cx={x} cy={y} r="1" fill="var(--finapp-primary)" />;
              })}
            </svg>
          </div>
          <div className={s.axis}>
            {rows.map((r, i) => (
              <span key={i}>{r.label}</span>
            ))}
          </div>
        </>
      ) : (
        <FinanceEmptyState
          kind="analytics"
          compact
          title="No progress history yet"
          description="Recorded contributions will shape your savings trend."
        />
      )}
    </>
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
export function Rankings({
  rows,
  currency,
}: {
  rows: readonly { name: string; amount: bigint }[];
  currency: string;
}) {
  const total = rows.reduce((n, r) => n + r.amount, 0n);
  return rows.length ? (
    <>
      {rows.slice(0, 5).map((r, i) => (
        <div key={r.name} className={s.ranking}>
          <span>
            {i + 1}. {r.name}
          </span>
          <Bar
            value={total > 0n ? Number((r.amount * 100n) / total) : 0}
            tone={chartColors[i % chartColors.length]}
          />
          <span>{formatMinor(r.amount, currency)}</span>
        </div>
      ))}
    </>
  ) : (
    <FinanceEmptyState
      kind="analytics"
      compact
      title="No spending recorded"
      description="Category rankings will appear when expenses are posted."
    />
  );
}
