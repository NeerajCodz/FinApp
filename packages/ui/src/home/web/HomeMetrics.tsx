import React from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Wallet } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import type { HomeDashboardData } from '../model';

export function HomeMetrics({ data, currency }: { data: HomeDashboardData; currency: string }) {
  const items = [
    {
      label: 'Total balance',
      value: formatMinor(data.balanceMinor, currency),
      note: 'Across selected accounts',
      icon: Wallet,
      kind: 'balance',
    },
    {
      label: 'Spent this period',
      value: formatMinor(data.spentMinor, currency),
      note: 'Posted expenses',
      icon: ArrowDownRight,
      kind: 'expense',
    },
    {
      label: 'Income this period',
      value: formatMinor(data.incomeMinor, currency),
      note: 'Posted income',
      icon: ArrowUpRight,
      kind: 'income',
    },
    {
      label: 'Net cash flow',
      value: formatMinor(data.netMinor, currency),
      note: 'Income minus spending',
      icon: ArrowUpRight,
      kind: 'net',
    },
    {
      label: 'Upcoming bills',
      value: formatMinor(data.upcomingBillsMinor, currency),
      note: `${data.upcomingBillsCount} due in the next 30 days`,
      icon: CalendarClock,
      kind: 'bills',
    },
  ];
  return (
    <section className="finance-home-metrics" aria-label="Financial overview">
      {items.map(({ label, value, note, icon: Icon, kind }) => (
        <article className={`finance-home-metric finance-home-metric-${kind}`} key={label}>
          <div className="finance-home-metric-top">
            <span>{label}</span>
            <Icon size={16} aria-hidden="true" />
          </div>
          <strong title={value}>{value}</strong>
          <small>{note}</small>
        </article>
      ))}
    </section>
  );
}
