import React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Text, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../money';
import { chartPalette } from '../../tokens';
import { ColumnChart, DonutChart, LineChart, compactMoney, fullMoney } from '../../charts/native';
import { toMajor } from '../../analytics/chart-utils';
export const colors = [
  chartPalette.blue,
  chartPalette.violet,
  chartPalette.yellow,
  chartPalette.pink,
  chartPalette.cyan,
];
export function Page({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 18,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 13,
      }}
    >
      {children}
    </ScrollView>
  );
}
export function Columns({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: width > 760 ? 'row' : 'column', gap: 13, alignItems: 'stretch' }}>
      {React.Children.map(children, (child) => (
        <View style={{ flex: 1, minWidth: 0, gap: 13 }}>{child}</View>
      ))}
    </View>
  );
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        gap: 11,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
      }}
    >
      <Typography variant="heading" style={{ fontSize: 17 }}>
        {title}
      </Typography>
      {!!description && (
        <Text style={{ fontSize: 12, lineHeight: 18, color: tokens.foregroundMuted }}>
          {description}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Metrics({
  items,
}: {
  items: readonly { label: string; value: string | number; detail?: string }[];
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      {items.map((r, i) => (
        <View
          key={r.label}
          style={{
            flexGrow: 1,
            flexBasis: '46%',
            padding: 14,
            gap: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: i === 1 ? tokens.destructive : tokens.primary, fontSize: 18 }}>
              {['◎', '▣', '◔', '▦', '⚑', '↗'][i % 6]}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: tokens.foregroundMuted }}>{r.label}</Text>
          <Typography variant="heading" style={{ fontSize: 21 }}>
            {r.value}
          </Typography>
          {!!r.detail && (
            <Text style={{ fontSize: 11, color: tokens.foregroundMuted }}>{r.detail}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
export function Bar({
  value,
  tone,
  large = false,
}: {
  value: number;
  tone?: string;
  large?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.max(0, Math.min(100, value)) }}
      style={{
        height: large ? 22 : 10,
        borderRadius: 8,
        backgroundColor: tokens.surfaceRaised,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          backgroundColor: tone ?? tokens.primary,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
/** A donut of parts (bigint amounts) with a value and label in the middle. */
export function Ring({
  segments,
  value,
  label,
}: {
  segments: readonly { amount: bigint; color?: string; name?: string }[];
  value: string;
  label: string;
}) {
  const { tokens } = useTheme();
  const total = segments.reduce(
    (sum, segment) => sum + (segment.amount > 0n ? segment.amount : 0n),
    0n,
  );
  if (total === 0n) {
    return (
      <FinanceEmptyState
        kind="analytics"
        title="Nothing to chart yet."
        description="Recorded amounts will fill this chart."
        compact
      />
    );
  }
  return (
    <View style={{ alignSelf: 'center' }}>
      <DonutChart
        caption={label}
        size={164}
        legend={false}
        centerValue={value}
        centerLabel={label}
        items={segments.map((segment, index) => {
          const share = segment.amount > 0n ? Number((segment.amount * 1000n) / total) / 10 : 0;
          return {
            id: String(index),
            label: segment.name ?? label,
            value: share,
            display: `${share}%`,
            color:
              segment.color ?? (index === 0 ? tokens.primary : colors[(index - 1) % colors.length]),
          };
        })}
      />
    </View>
  );
}
export function Legend({
  rows,
  currency,
}: {
  rows: readonly { name: string; amount: bigint; color?: string }[];
  currency: string;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                r.color ?? (i === 0 ? tokens.primary : colors[(i - 1) % colors.length]),
            }}
          />
          <Text style={{ flex: 1, fontSize: 12 }}>{r.name}</Text>
          <Text style={{ fontSize: 12 }}>{formatMinor(r.amount, currency)}</Text>
        </View>
      ))}
    </View>
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
  const { tokens } = useTheme();
  if (!rows.some((row) => row.amount > 0n)) {
    return (
      <FinanceEmptyState
        kind="analytics"
        title="Nothing to chart yet."
        description="Recorded amounts will fill this chart."
        compact
      />
    );
  }
  const parts = Math.max(1, ...rows.map((row) => row.segments?.length ?? 1));
  const series = Array.from({ length: parts }, (_, index) => {
    const sample = rows.find((row) => row.segments?.[index])?.segments?.[index];
    return {
      id: String(index),
      label: sample?.name ?? (parts === 1 ? 'Amount' : `Part ${index + 1}`),
      color: sample?.color ?? (index === 0 ? tokens.primary : colors[(index - 1) % colors.length]),
      values: rows.map((row) =>
        toMajor(
          row.segments ? (row.segments[index]?.amount ?? 0n) : index === 0 ? row.amount : 0n,
          currency,
        ),
      ),
    };
  });
  return (
    <ColumnChart
      caption={`Monthly amounts in ${currency}`}
      mode={parts > 1 ? 'stacked' : 'grouped'}
      height={180}
      labels={rows.map((row) => row.label)}
      series={series}
      line={
        target !== undefined
          ? { id: 'target', label: 'Required', values: rows.map(() => toMajor(target, currency)) }
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
  const { tokens } = useTheme();
  if (!rows.some((row) => row.amount > 0n)) {
    return (
      <FinanceEmptyState
        kind="analytics"
        title="Nothing to chart yet."
        description="Recorded amounts will fill this chart."
        compact
      />
    );
  }
  return (
    <LineChart
      caption={`Savings trend in ${currency}`}
      height={180}
      labels={rows.map((row) => row.label)}
      series={[
        {
          id: 'saved',
          label: 'Saved',
          values: rows.map((row) => toMajor(row.amount, currency)),
          color: tokens.primary,
        },
        ...(target !== undefined
          ? [
              {
                id: 'target',
                label: 'Target',
                values: rows.map(() => toMajor(target, currency)),
                color: tokens.foregroundMuted,
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
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 13 }}>
      {[25, 50, 75, 100].map((percent) => {
        const amount = (target * BigInt(percent) + 99n) / 100n;
        const done = saved >= amount && target > 0n;
        const row = rows?.find((r) => r.percent === percent);
        return (
          <View key={percent} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, color: done ? tokens.primary : tokens.foregroundMuted }}>
              {done ? '●' : '○'}
            </Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 12 }}>{percent}% complete</Text>
              <Bar value={amount > 0n ? Number((saved * 100n) / amount) : 0} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ fontSize: 12 }}>{formatMinor(amount, currency)}</Text>
              <Text style={{ fontSize: 10, color: tokens.foregroundMuted }}>
                {row?.achievedAt
                  ? new Date(row.achievedAt).toLocaleDateString()
                  : row?.projectedAt
                    ? `Est. ${new Date(row.projectedAt).toLocaleDateString()}`
                    : done
                      ? 'Completed'
                      : 'Upcoming'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
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
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      {history.length ? (
        [...history]
          .sort((a, b) => b.occurredAt - a.occurredAt)
          .slice(0, 8)
          .map((r) => (
            <View
              key={r.id}
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: tokens.borderSubtle,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 12 }}>{new Date(r.occurredAt).toLocaleDateString()}</Text>
                <Text style={{ fontSize: 11, color: tokens.foregroundMuted }}>
                  {accounts.find((a) => a.id === r.accountId)?.name ?? 'Manual contribution'}
                </Text>
              </View>
              <Text style={{ color: tokens.primary, fontSize: 13 }}>
                +{formatMinor(r.amount, currency)}
              </Text>
            </View>
          ))
      ) : (
        <FinanceEmptyState
          kind="contribution"
          title="No contributions recorded yet."
          description="Contributions toward this goal will appear here."
          compact
        />
      )}
    </View>
  );
}
