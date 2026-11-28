'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@finapp/ui/web';
import { formatDay, formatNumber } from '@/lib/format';

export const SERIES_COLORS = [
  'blue',
  'volt',
  'violet',
  'orange',
  'cyan',
  'pink',
  'yellow',
] as const;

export function useChartTheme() {
  const { tokens } = useTheme();
  return {
    grid: tokens.borderSubtle,
    axis: tokens.foregroundMuted,
    tooltip: {
      contentStyle: {
        background: tokens.popover,
        border: `1px solid ${tokens.border}`,
        borderRadius: 12,
        color: tokens.foreground,
      },
      labelStyle: { color: tokens.foregroundMuted },
    },
    color: (index: number) => tokens.chart[SERIES_COLORS[index % SERIES_COLORS.length]!],
  };
}

type Series = { key: string; label: string };
type Point = Record<string, number>;

export function TimeChart({
  data,
  series,
  kind = 'area',
  format = (value: number) => formatNumber(value, true),
}: {
  data: Point[];
  series: Series[];
  kind?: 'area' | 'line' | 'bar';
  format?: (value: number) => string;
}) {
  const theme = useChartTheme();
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid stroke={theme.grid} vertical={false} />
      <XAxis
        dataKey="day"
        tickFormatter={(value: number) => formatDay(value)}
        stroke={theme.axis}
        tick={{ fontSize: 12 }}
        minTickGap={24}
      />
      <YAxis
        stroke={theme.axis}
        tick={{ fontSize: 12 }}
        tickFormatter={(value: number) => format(value)}
        width={56}
        allowDecimals={false}
      />
      <Tooltip
        {...theme.tooltip}
        labelFormatter={(value) => formatDay(Number(value))}
        formatter={(value, name) => [format(Number(value)), String(name)]}
      />
      {series.length > 1 ? <Legend /> : null}
    </>
  );
  return (
    <div className="admin-chart">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar' ? (
          <BarChart {...common}>
            {axes}
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={theme.color(index)}
                radius={[4, 4, 0, 0]}
                stackId={series.length > 1 ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        ) : kind === 'line' ? (
          <LineChart {...common}>
            {axes}
            {series.map((item, index) => (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stroke={theme.color(index)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart {...common}>
            {axes}
            {series.map((item, index) => (
              <Area
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stroke={theme.color(index)}
                fill={theme.color(index)}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function SplitChart({ data }: { data: { label: string; value: number }[] }) {
  const theme = useChartTheme();
  if (!data.length) return <div className="admin-empty">No data yet.</div>;
  return (
    <div className="admin-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%">
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={theme.color(index)} stroke="none" />
            ))}
          </Pie>
          <Tooltip {...theme.tooltip} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranked lists (features, groups). */
export function RankBars({
  rows,
  format = (value: number) => formatNumber(value),
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="admin-empty">No data yet.</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
            <span>{row.label}</span>
            <span className="admin-muted">
              {format(row.value)}
              {row.hint ? ` · ${row.hint}` : ''}
            </span>
          </div>
          <div className="admin-bar">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
