import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import {
  budgetDashboard,
  type BudgetDashboardTransaction,
  type BudgetSettings,
} from '../budgetDashboard';
import { Bar, Bars, Legend, Ring } from './GoalsBudgetsParts';
export type BudgetDetailItem = {
  id: string;
  title: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  accountId?: string;
  accountName?: string;
  merchant?: string;
  occurredAt?: number;
  categoryName?: string;
};
export function BudgetDetailScreen({
  name,
  category,
  icon,
  currency,
  limit,
  spent,
  transactions,
  allTransactions,
  startAt,
  endAt,
  settings,
  accounts = [],
  loading,
  error,
  actionError,
  pending,
  onEdit,
  onAnalytics,
  onArchive,
  onOpenTransaction,
  onAddExpense,
}: {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  spent: bigint;
  transactions: readonly BudgetDetailItem[];
  allTransactions?: readonly BudgetDashboardTransaction[];
  startAt?: number;
  endAt?: number;
  settings?: BudgetSettings;
  accounts?: readonly { id: string; name: string }[];
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  pending?: boolean;
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
  onOpenTransaction: (id: string) => void;
  onAddExpense?: () => void;
}) {
  const { tokens } = useTheme();
  const now = new Date();
  const start = startAt ?? new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = endAt ?? new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const dashboard = budgetDashboard(
    allTransactions ??
      transactions.flatMap((row) =>
        typeof row.occurredAt === 'number' ? [{ ...row, occurredAt: row.occurredAt }] : [],
      ),
    start,
    end,
    limit,
  );
  const ratio = limit > 0n ? Number((spent * 10000n) / limit) / 100 : 0;
  const remaining = limit - spent;
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingTop: 16, paddingBottom: 40, gap: 16 }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CategoryIcon label={category} icon={icon} />
        <View style={{ flex: 1 }}>
          <Typography variant="title">{name}</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>{category} · Category budget</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="outline" onPress={onAnalytics} style={{ flex: 1 }}>
            Analytics
          </Button>
          <Button onPress={onEdit} style={{ flex: 1 }}>
            Edit
          </Button>
        </View>
        {onAddExpense && <Button onPress={onAddExpense}>＋ Add expense</Button>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          ['Period limit', formatMinor(limit, currency)],
          ['Spent so far', formatMinor(dashboard.spent, currency)],
          ['Remaining', formatMinor(dashboard.remaining, currency)],
          ['Daily average', formatMinor(dashboard.average, currency)],
          ['Forecasted spend', formatMinor(dashboard.forecast, currency)],
          [
            'Status',
            ratio >= 100 ? 'Over budget' : dashboard.forecast > limit ? 'At risk' : 'On track',
          ],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{
              flexGrow: 1,
              minWidth: 125,
              padding: 14,
              borderRadius: 15,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Text style={{ color: tokens.foregroundMuted }}>{label}</Text>
            <Typography variant="heading">{value}</Typography>
          </View>
        ))}
      </View>
      <View
        style={{ gap: 12, padding: 16, borderRadius: 15, backgroundColor: tokens.surfaceRaised }}
      >
        <Typography variant="title">Budget progress</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          {new Date(start).toLocaleDateString()} – {new Date(end - 1).toLocaleDateString()} ·{' '}
          {dashboard.daysLeft} days left
        </Text>
        <Bar value={ratio} large tone={ratio >= 100 ? tokens.destructive : undefined} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text>{formatMinor(dashboard.spent, currency)} spent</Text>
          <Text>
            {formatMinor(limit, currency)} limit · {Math.round(ratio)}%
          </Text>
        </View>
        <Text style={{ color: tokens.foregroundMuted }}>
          At your current pace, projected spending is {formatMinor(dashboard.forecast, currency)}.
        </Text>
      </View>
      <View
        style={{ gap: 12, padding: 16, borderRadius: 15, backgroundColor: tokens.surfaceRaised }}
      >
        <Typography variant="title">Spending over time</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>Daily spending in this budget cycle.</Text>
        <Bars rows={dashboard.buckets} currency={currency} />
      </View>
      <View
        style={{ gap: 12, padding: 16, borderRadius: 15, backgroundColor: tokens.surfaceRaised }}
      >
        <Typography variant="title">Spending by merchant</Typography>
        <Ring
          segments={dashboard.merchants}
          value={formatMinor(dashboard.spent, currency)}
          label="Total spent"
        />
        <Legend rows={dashboard.merchants.slice(0, 6)} currency={currency} />
      </View>
      <View
        style={{
          gap: 10,
          padding: 16,
          borderRadius: 15,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="title">Budget details</Typography>
        <DetailRow label="Category" value={category} />
        <DetailRow
          label="Applies to"
          value={
            settings?.accountIds?.length
              ? settings.accountIds
                  .map(
                    (id) =>
                      accounts.find((account) => account.id === id)?.name ?? 'Unavailable account',
                  )
                  .join(', ')
              : 'All accounts'
          }
        />
        <DetailRow
          label="Budget period"
          value={
            startAt && endAt
              ? `${new Date(startAt).toLocaleDateString()} – ${new Date(endAt - 1).toLocaleDateString()}`
              : 'Explicit dates'
          }
        />
        <DetailRow label="Rollover" value="No rollover" />
        <DetailRow label="Alerts" value={`${settings?.alertThreshold ?? 80}% of limit`} />
        <DetailRow
          label="Include in analytics"
          value={settings?.includeInAnalytics === false ? 'No' : 'Yes'}
        />
        <DetailRow label="Notes" value={settings?.notes?.trim() || 'No notes'} />
      </View>
      <Button variant="outline" disabled={pending} onPress={onArchive}>
        Archive budget
      </Button>
      {actionError && <Text style={{ color: tokens.destructive }}>{actionError}</Text>}
      {error && <Text style={{ color: tokens.destructive }}>{error}</Text>}
      {loading ? (
        <Text>Loading posted expenses…</Text>
      ) : transactions.length ? (
        <View style={{ gap: 8 }}>
          {transactions.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenTransaction(item.id)}
              style={{ padding: 14, borderRadius: 14, backgroundColor: tokens.surfaceRaised }}
            >
              <Text>{item.title}</Text>
              <Text style={{ color: tokens.foregroundMuted }}>
                {item.date} · {formatMinor(item.amountMinor, item.currency)}
                {item.accountName ? ` · ${item.accountName}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <FinanceEmptyState
          kind="budget"
          title="No posted expenses yet."
          description="Posted expenses assigned to this budget will appear here."
          compact
        />
      )}
    </ScrollView>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ color: tokens.foregroundMuted }}>{label}</Text>
      <Text style={{ flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
