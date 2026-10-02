import React from 'react';
import { View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polyline, Polygon, Line } from 'react-native-svg';
import { Text, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../money';
export const colors = ['#3dbdeb', '#ae83f5', '#ffbe46', '#fa4960', '#85949f'];
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
      {description && (
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
          {r.detail && (
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
export function Ring({
  segments,
  value,
  label,
}: {
  segments: readonly { amount: bigint; color?: string }[];
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
  let offset = 0;
  return (
    <View style={{ width: 164, height: 164, alignSelf: 'center' }}>
      <Svg viewBox="0 0 120 120" width="100%" height="100%">
        <Circle cx={60} cy={60} r={49} stroke={tokens.surfaceRaised} strokeWidth={14} fill="none" />
        {segments.map((segment, index) => {
          const share = Number((segment.amount * 10000n) / total) / 100;
          const start = offset;
          offset += share;
          return (
            <Circle
              key={index}
              cx={60}
              cy={60}
              r={49}
              stroke={
                segment.color ??
                (index === 0 ? tokens.primary : colors[(index - 1) % colors.length])
              }
              strokeWidth={14}
              fill="none"
              strokeDasharray={`${share * 3.079} ${(100 - share) * 3.079}`}
              strokeDashoffset={-start * 3.079}
              rotation={-90}
              origin="60,60"
            />
          );
        })}
      </Svg>
      <View
        style={{
          position: 'absolute',
          inset: 28,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Typography variant="heading" style={{ fontSize: 21, textAlign: 'center' }}>
          {value}
        </Typography>
        <Text style={{ fontSize: 11, color: tokens.foregroundMuted, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
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
  const max =
    rows.reduce((highest, row) => (row.amount > highest ? row.amount : highest), target ?? 0n) ||
    1n;
  return (
    <View>
      <View
        style={{
          height: 150,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 5,
          borderBottomWidth: 1,
          borderColor: tokens.borderSubtle,
        }}
      >
        {rows.map((row) => (
          <View
            key={row.label}
            accessibilityLabel={`${row.label}: ${formatMinor(row.amount, currency)}`}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 1 }}
          >
            {(row.segments ?? [{ amount: row.amount }]).map((segment, index) => (
              <View
                key={index}
                style={{
                  height: `${Number((segment.amount * 10000n) / max) / 100}%`,
                  backgroundColor:
                    segment.color ??
                    (index === 0 ? tokens.primary : colors[(index - 1) % colors.length]),
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 7 }}>
        {rows
          .filter((_, index) => rows.length < 10 || index % 5 === 0)
          .map((row) => (
            <Text key={row.label} style={{ fontSize: 10, color: tokens.foregroundMuted }}>
              {row.label}
            </Text>
          ))}
      </View>
    </View>
  );
}
export function Trend({
  rows,
  target,
}: {
  rows: readonly { label: string; amount: bigint }[];
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
  const max =
    rows.reduce((highest, row) => (row.amount > highest ? row.amount : highest), target ?? 0n) ||
    1n;
  const points = rows.map(
    (row, index) =>
      `${rows.length > 1 ? (index * 100) / (rows.length - 1) : 0},${95 - Number((row.amount * 9000n) / max) / 100}`,
  );
  return (
    <View>
      <Svg width="100%" height={150} viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20, 40, 60, 80].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={100}
            y1={y}
            y2={y}
            stroke={tokens.borderSubtle}
            strokeWidth={0.3}
          />
        ))}
        <Polygon
          points={`0,100 ${points.join(' ')} 100,100`}
          fill={tokens.primary}
          opacity={0.12}
        />
        <Polyline points={points.join(' ')} stroke={tokens.primary} fill="none" strokeWidth={1} />
        {target !== undefined && (
          <Line
            x1={0}
            x2={100}
            y1={95 - Number((target * 9000n) / max) / 100}
            y2={95 - Number((target * 9000n) / max) / 100}
            stroke={tokens.foregroundMuted}
            strokeDasharray="2 2"
            strokeWidth={0.5}
          />
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {rows.map((row, index) => (
          <Text key={index} style={{ fontSize: 10, color: tokens.foregroundMuted }}>
            {row.label}
          </Text>
        ))}
      </View>
    </View>
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
export function BudgetTable({
  rows,
  onOpen,
}: {
  rows: readonly {
    id: string;
    title: string;
    amountMinor: bigint;
    currency: string;
    date?: string;
    occurredAt?: number;
    accountName?: string;
  }[];
  onOpen?: (id: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View>
      {rows.length ? (
        rows.slice(0, 8).map((r) => (
          <Pressable
            accessibilityRole={onOpen ? 'button' : undefined}
            key={r.id}
            onPress={onOpen ? () => onOpen(r.id) : undefined}
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 13 }}>{r.title}</Text>
              <Text style={{ fontSize: 11, color: tokens.foregroundMuted }}>
                {r.accountName ?? 'Unavailable account'} ·{' '}
                {r.date ??
                  (r.occurredAt ? new Date(r.occurredAt).toLocaleDateString() : 'Date unavailable')}
              </Text>
            </View>
            <Text style={{ color: tokens.destructive, fontSize: 13 }}>
              −{formatMinor(r.amountMinor, r.currency)}
            </Text>
          </Pressable>
        ))
      ) : (
        <FinanceEmptyState
          kind="budget"
          title="No posted expenses in this date range."
          description="Choose a period with activity to review budget transactions."
          compact
        />
      )}
    </View>
  );
}
export function Rankings({
  rows,
  currency,
}: {
  rows: readonly { name: string; amount: bigint }[];
  currency: string;
}) {
  const { tokens } = useTheme();
  const total = rows.reduce((n, r) => n + r.amount, 0n);
  return (
    <View style={{ gap: 12 }}>
      {rows.length ? (
        rows.slice(0, 5).map((r, i) => (
          <View key={r.name} style={{ gap: 7 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12 }}>
                {i + 1}. {r.name}
              </Text>
              <Text style={{ fontSize: 12 }}>{formatMinor(r.amount, currency)}</Text>
            </View>
            <Bar
              value={total > 0n ? Number((r.amount * 100n) / total) : 0}
              tone={i === 0 ? tokens.primary : colors[(i - 1) % colors.length]}
            />
          </View>
        ))
      ) : (
        <FinanceEmptyState
          kind="analytics"
          title="No spending recorded."
          description="Spending rankings will appear when transactions are recorded."
          compact
        />
      )}
    </View>
  );
}
