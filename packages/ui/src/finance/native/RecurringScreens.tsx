import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { ArrowLeft, ArrowRight, CalendarDays } from '@finapp/ui/icons/native';
import { Button, Card, Empty, Input, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';
import { CurrencyInput } from './CurrencyInput';

export type RecurringRuleView = {
  id: string;
  name?: string;
  frequency?: string;
  interval?: number;
  nextOccurrence?: number;
  enabled?: boolean;
  autoCreate?: boolean;
  createdAt?: number;
  archivedAt?: number;
  template?: {
    type?: string;
    amountMinor?: bigint | number | string;
    currency?: string;
    accountId?: string;
  };
};
export type RecurringAccountView = {
  id: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
export type RecurringCreateValues = {
  name: string;
  amount: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
};
type SharedProps = { loading?: boolean; error?: string; pending?: boolean; onRetry?: () => void };
export type RecurringIndexViewProps = SharedProps & {
  rules: readonly RecurringRuleView[];
  accounts: readonly RecurringAccountView[];
  connected?: boolean;
  actionError?: string | null;
  onOpen: (id: string) => void;
  onAddAccount: () => void;
  onToggle: (rule: RecurringRuleView) => void;
  onCreate: (values: RecurringCreateValues) => Promise<boolean>;
};
export type RecurringDetailViewProps = SharedProps & {
  rule: RecurringRuleView | null;
  accountName?: string;
  actionError?: string | null;
  onBack: () => void;
  onToggle: (rule: RecurringRuleView) => void;
};
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const dateText = (at?: number) =>
  at && Number.isFinite(at)
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(at)
    : 'Not scheduled';
function upcoming(rule: RecurringRuleView, now: number, count: number) {
  let at = Number(rule.nextOccurrence ?? 0);
  const frequency = rule.frequency;
  if (!at || !frequency || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(frequency))
    return [];
  let guard = 0;
  while (at <= now && guard++ < 1024)
    at = nextOccurrence(at, frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  const result: number[] = [];
  while (at > 0 && result.length < count) {
    result.push(at);
    at = nextOccurrence(at, frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  }
  return result;
}
function amountText(rule: RecurringRuleView) {
  const value = rule.template?.amountMinor;
  const currency = rule.template?.currency;
  if (value === undefined || !currency) return null;
  try {
    return formatMinor(typeof value === 'bigint' ? value : BigInt(value), currency);
  } catch {
    return null;
  }
}

export function RecurringIndexView({
  rules,
  accounts,
  loading = false,
  error,
  pending = false,
  connected = true,
  actionError,
  onRetry,
  onOpen,
  onAddAccount,
  onToggle,
  onCreate,
}: RecurringIndexViewProps) {
  const { tokens } = useTheme();
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'expenses' | 'income' | 'active'>('all');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [frequency, setFrequency] = React.useState<(typeof frequencies)[number]>('monthly');
  const now = Date.now();
  const visible = rules
    .filter((rule) => rule.archivedAt === undefined)
    .slice()
    .sort((a, b) => Number(a.nextOccurrence ?? 0) - Number(b.nextOccurrence ?? 0));
  const active = visible.filter((rule) => rule.enabled);
  const displayed = visible.filter((rule) => {
    const matchesQuery = `${rule.name ?? ''} ${rule.frequency ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
    const isIncome = rule.template?.type === 'income';
    return (
      matchesQuery &&
      (filter === 'all' ||
        (filter === 'expenses' && !isIncome) ||
        (filter === 'income' && isIncome) ||
        (filter === 'active' && rule.enabled))
    );
  });
  const primaryCurrency = active.find((rule) => rule.template?.currency)?.template?.currency;
  const monthExpenses = active.filter(
    (rule) => rule.template?.type !== 'income' && rule.template?.currency === primaryCurrency,
  );
  const monthlyTotal = monthExpenses.reduce((sum, rule) => {
    const amount = rule.template?.amountMinor;
    if (amount === undefined) return sum;
    try {
      const base = BigInt(amount);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      switch (rule.frequency) {
        case 'daily':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'custom':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'weekly':
          return sum + base * BigInt(Math.floor(4 / interval));
        case 'yearly':
          return sum + base / BigInt(12 * interval);
        default:
          return sum + base / BigInt(interval);
      }
    } catch {
      return sum;
    }
  }, 0n);
  const incomeRules = active.filter(
    (rule) => rule.template?.type === 'income' && rule.template?.currency === primaryCurrency,
  );
  const monthlyIncome = incomeRules.reduce((sum, rule) => {
    const amount = rule.template?.amountMinor;
    if (amount === undefined) return sum;
    try {
      const base = BigInt(amount);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      switch (rule.frequency) {
        case 'daily':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'custom':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'weekly':
          return sum + base * BigInt(Math.floor(4 / interval));
        case 'yearly':
          return sum + base / BigInt(12 * interval);
        default:
          return sum + base / BigInt(interval);
      }
    } catch {
      return sum;
    }
  }, 0n);
  const upcomingCount = active
    .flatMap((rule) => upcoming(rule, now, 1))
    .filter((at) => at <= now + 7 * 86_400_000).length;
  const usableAccounts = accounts.filter((account) => account.archivedAt === undefined);
  const selectedAccount =
    usableAccounts.find((account) => account.id === accountId) ?? usableAccounts[0];
  async function submit() {
    if (!name.trim() || !amount.trim() || !selectedAccount) return;
    const saved = await onCreate({
      name: name.trim(),
      amount: amount.trim(),
      accountId: selectedAccount.id,
      frequency,
    });
    if (!saved) return;
    setName('');
    setAmount('');
    setAdding(false);
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{flex:1,backgroundColor:tokens.background}} contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Typography variant="title">Recurring</Typography>
          <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>Manage your subscriptions, bills and recurring income.</Typography>
        </View>
        {!adding && (
          <Button disabled={loading || !!error || pending} onPress={() => setAdding(true)}>
            Add reminder
          </Button>
        )}
      </View>
      {!loading && !error && (
        <View style={{ flexDirection:'row',flexWrap:'wrap',gap:10 }}>
          {[
            [
              'Total recurring',
              String(visible.length),
              `${active.length} active · ${visible.length - active.length} paused`,
            ],
            [
              'Monthly expenses',
              primaryCurrency
                ? (() => {
                    try {
                      return formatMinor(monthlyTotal, primaryCurrency);
                    } catch {
                      return '—';
                    }
                  })()
                : '—',
              'Estimated from active rules',
            ],
            [
              'Monthly income',
              primaryCurrency
                ? (() => {
                    try {
                      return formatMinor(monthlyIncome, primaryCurrency);
                    } catch {
                      return '—';
                    }
                  })()
                : '—',
              'Estimated from active rules',
            ],
            ['Upcoming this week', String(upcomingCount), 'Next 7 days'],
          ].map(([label, value, note]) => (
            <Card key={label} style={{ padding: 14, gap: 5, width:'48%',borderRadius:12 }}>
              <Typography variant="caption">{label}</Typography>
              <Typography variant="heading">{value}</Typography>
              <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
                {note}
              </Typography>
            </Card>
          ))}
        </View>
      )}
      {loading && (
        <Card style={{ padding: 18 }} accessibilityRole="progressbar">
          <Typography variant="small">Loading your recurring schedules…</Typography>
        </Card>
      )}
      {error && (
        <Card style={{ padding: 18, gap: 12 }} accessibilityRole="alert">
          <Typography variant="small">Your saved schedules could not be loaded.</Typography>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </Card>
      )}
      {!!actionError && (
        <Typography variant="small" style={{ color: tokens.destructive }} accessibilityRole="alert">
          {actionError}
        </Typography>
      )}
      {!loading && !error && visible.length === 0 && !adding && (
        <Empty
          title="No recurring reminders"
          description="Add a reminder for a repeating expense. You choose when to record it."
          icon={<CalendarDays size={22} color={tokens.primary} />}
          action={<Button onPress={() => setAdding(true)}>Add reminder</Button>}
        />
      )}
      {!loading && !error && visible.length > 0 && (
        <View style={{ gap: 10 }}>
          <Input
            accessibilityLabel="Search recurring schedules"
            placeholder="Search recurring…"
            value={query}
            onChangeText={setQuery}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {(['all', 'expenses', 'income', 'active'] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? 'secondary' : 'outline'}
                accessibilityState={{ selected: filter === item }}
                onPress={() => setFilter(item)}
              >
                {item === 'all'
                  ? `All (${visible.length})`
                  : item === 'expenses'
                    ? 'Expenses'
                    : item === 'income'
                      ? 'Income'
                      : 'Active'}
              </Button>
            ))}
          </View>
          {displayed.length ? (
            <Card style={{ padding: 16, gap: 2,borderRadius:12 }}>
              <Typography variant="heading">Your recurring transactions</Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>Subscriptions, bills and recurring income.</Typography>
              <View style={{ height: 10 }} />
              {displayed.map((rule) => {
                const money = amountText(rule);
                const at = upcoming(rule, now, 1)[0];
                const income = rule.template?.type === 'income';
                return (
                  <View
                    key={rule.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 13,
                      borderTopWidth: 1,
                      borderColor: tokens.borderSubtle,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: tokens.surfaceRaised,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {income ? (
                        <ArrowRight size={19} color={tokens.primary} />
                      ) : (
                        <CalendarDays size={19} color={tokens.primary} />
                      )}
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => onOpen(rule.id)}
                      style={{ flex: 1, minWidth: 0, gap: 3 }}
                    >
                      <Typography variant="bodyLarge" numberOfLines={1}>{rule.name || 'Recurring reminder'}</Typography>
                      <Typography variant="caption" style={{color:tokens.foregroundMuted}}>{rule.frequency || 'Schedule'} · {rule.enabled ? `Next ${dateText(at)}` : 'Paused'}</Typography>
                      <Typography variant="caption" style={{color:tokens.foregroundMuted}}>Unassigned category · {accounts.find(account=>account.id===rule.template?.accountId||account.cloudId===rule.template?.accountId)?.name??'Account unavailable'}</Typography>
                      {money && <Typography variant="bodyLarge" style={{color:income?tokens.income:tokens.expense}}>{income?'+':'−'}{money}</Typography>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name || 'reminder'}`}
                      disabled={pending}
                      onPress={() => onToggle(rule)}
                      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10,borderRadius:7,backgroundColor:tokens.surfaceRaised }}
                    >
                      <Typography variant="small" style={{ color: rule.enabled?tokens.income:tokens.warning }}>{rule.enabled ? 'Active' : 'Paused'}</Typography>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Card>
          ) : (
            <Card style={{ padding: 18 }}>
              <Typography variant="small">No schedules match this search or filter.</Typography>
            </Card>
          )}
        </View>
      )}
      {!connected && !loading && (
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          Offline · showing saved schedules
        </Typography>
      )}
      {adding && (
        <Card style={{ padding: 18, gap: 13 }}>
          <Typography variant="heading">New reminder</Typography>
          <Input
            accessibilityLabel="Expense name"
            placeholder="Expense name"
            value={name}
            onChangeText={setName}
          />
          <Typography variant="label">Account</Typography>
          {usableAccounts.map((account) => (
            <Button
              key={account.id}
              size="sm"
              variant={selectedAccount?.id === account.id ? 'secondary' : 'outline'}
              onPress={() => setAccountId(account.id)}
              style={{ justifyContent: 'flex-start' }}
            >
              {account.name || 'Account'} · {account.currency || 'INR'}
            </Button>
          ))}
          {usableAccounts.length === 0 && (
            <View style={{ gap: 6 }}>
              <Typography variant="small">Create an account before adding a reminder.</Typography>
              <Button variant="outline" size="sm" onPress={onAddAccount}>
                Add account
              </Button>
            </View>
          )}
          <CurrencyInput currency={selectedAccount?.currency??'INR'} value={amount} onChangeText={setAmount}/>
          <Typography variant="label">Repeat from tomorrow</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {frequencies.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={frequency === option ? 'secondary' : 'outline'}
                accessibilityState={{ selected: frequency === option }}
                onPress={() => setFrequency(option)}
              >
                {option}
              </Button>
            ))}
          </View>
          <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
            First reminder is tomorrow. You decide when to record the expense.
          </Typography>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button style={{ flex: 1 }} variant="outline" onPress={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              style={{ flex: 1 }}
              disabled={pending || !name.trim() || !amount.trim() || !selectedAccount}
              onPress={submit}
            >
              {pending ? 'Saving…' : 'Save reminder'}
            </Button>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

export function RecurringDetailView({
  rule,
  accountName,
  loading = false,
  error,
  actionError,
  pending = false,
  onRetry,
  onBack,
  onToggle,
}: RecurringDetailViewProps) {
  const { tokens } = useTheme();
  const now = Date.now();
  if (loading)
    return (
      <View style={{ padding: 20 }}>
        <Card style={{ padding: 20 }}>
          <Typography variant="small">Loading recurring schedule…</Typography>
        </Card>
      </View>
    );
  if (error || !rule)
    return (
      <View style={{ padding: 20, gap: 14 }}>
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} color={tokens.foreground} /> Back to recurring
        </Button>
        <Card style={{ padding: 20, gap: 12 }} accessibilityRole={error ? 'alert' : undefined}>
          <Typography variant="heading">
            {error ? 'Schedule unavailable' : 'Schedule not found'}
          </Typography>
          <Typography variant="small">
            {error
              ? 'This recurring schedule could not be loaded.'
              : 'This schedule may have been removed or is not available to your account.'}
          </Typography>
          {error && (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          )}
        </Card>
      </View>
    );
  const amount = amountText(rule);
  const dates = rule.enabled ? upcoming(rule, now, 5) : [];
  const frequency = rule.frequency || 'Not set';
  const normalized = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const annualMinor = (() => {
    const value = rule.template?.amountMinor;
    if (value === undefined) return null;
    try {
      const raw = BigInt(value);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      switch (frequency) {
        case 'monthly':
          return raw * BigInt(Math.floor(12 / interval));
        case 'weekly':
          return raw * BigInt(Math.floor(52 / interval));
        case 'daily':
        case 'custom':
          return raw * BigInt(Math.floor(365 / interval));
        case 'yearly':
          return raw / BigInt(interval);
        default:
          return null;
      }
    } catch {
      return null;
    }
  })();
  const annualText =
    annualMinor !== null && rule.template?.currency
      ? (() => {
          try {
            return formatMinor(annualMinor, rule.template.currency!);
          } catch {
            return null;
          }
        })()
      : null;
  return (
    <ScrollView style={{flex:1,backgroundColor:tokens.background}} contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }}>
      <Button variant="ghost" onPress={onBack}>
        <ArrowLeft size={18} color={tokens.foreground} /> Recurring
      </Button>
      <View style={{ gap: 10 }}>
        <Typography variant="title">{rule.name || 'Recurring reminder'}</Typography>
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          {normalized} schedule ·{' '}
          {rule.template?.type === 'income' ? 'Recurring income' : 'Recurring expense'}
        </Typography>
        <Button variant="outline" disabled={pending} onPress={() => onToggle(rule)}>
          <CalendarDays size={17} color={tokens.foreground} />
          {rule.enabled ? 'Pause schedule' : 'Resume schedule'}
        </Button>
      </View>
      {!!actionError && (
        <Typography variant="small" style={{ color: tokens.destructive }} accessibilityRole="alert">
          {actionError}
        </Typography>
      )}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
      {[
        ['Amount', amount || 'Not set'],
        ['Annual estimate', annualText || 'Not available'],
        ['Next occurrence', rule.enabled ? dateText(dates[0] ?? rule.nextOccurrence) : 'Paused'],
        ['Status', rule.enabled ? 'Active' : 'Paused'],
      ].map(([label, value]) => (
        <Card key={label} style={{ padding: 14, gap: 5,width:'48%',borderRadius:12 }}>
          <Typography variant="caption">{label}</Typography>
          <Typography variant="heading">{value}</Typography>
        </Card>
      ))}
      </View>
      <Card style={{ padding: 17, gap: 8,borderRadius:12 }}>
        <Typography variant="heading">Recurring details</Typography>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          Information stored with this schedule.
        </Typography>
        {[
          ['Name', rule.name || 'Recurring reminder'],
          ['Category','Unassigned'],
          ['Amount', amount || 'Not set'],
          ['Frequency', normalized],
          ['Interval', `Every ${Math.max(1, Number(rule.interval ?? 1))} ${frequency}`],
          ['Account', accountName || 'Account unavailable'],
          ['Created on', dateText(rule.createdAt)],
          ['Next reminder', rule.enabled ? dateText(dates[0] ?? rule.nextOccurrence) : 'Paused'],
          ['Behavior', rule.autoCreate ? 'Automatic transaction' : 'Reminder only'],
        ].map(([key, value]) => (
          <View
            key={key}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 8,
              paddingVertical: 9,
              borderTopWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Typography variant="small" style={{ color: tokens.foregroundMuted, flex: 1 }}>
              {key}
            </Typography>
            <Typography variant="small" style={{ flex: 1, textAlign: 'right' }}>
              {value}
            </Typography>
          </View>
        ))}
      </Card>
      <Card style={{ padding: 17, gap: 6,borderRadius:12 }}>
        <Typography variant="heading">Next reminders</Typography>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>Upcoming reminder dates, not confirmed payments.</Typography>
        {dates.length ? (
          dates.map((at) => (
            <View
              key={at}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingVertical: 11,
                borderTopWidth: 1,
                borderColor: tokens.borderSubtle,
              }}
            >
              <CalendarDays size={18} color={tokens.primary} />
              <Typography variant="small" style={{ flex: 1 }}>
                {dateText(at)}
              </Typography>
              <Typography variant="bodyLarge" style={{color:rule.template?.type==='income'?tokens.income:tokens.expense}}>{amount || '—'}</Typography>
            </View>
          ))
        ) : (
          <Typography
            variant="small"
            style={{ color: tokens.foregroundMuted, paddingVertical: 14 }}
          >
            {rule.enabled
              ? 'No valid upcoming date is available for this schedule.'
              : 'Resume this schedule to see upcoming dates.'}
          </Typography>
        )}
      </Card>
      <Card style={{padding:16,gap:10,borderRadius:12}}>
        <Typography variant="heading">Transaction history</Typography>
        <Typography variant="caption">Recorded transactions associated with this reminder.</Typography>
        <Typography variant="small" style={{color:tokens.foregroundMuted,paddingVertical:20}}>This reminder does not have linked transaction history. Past reminder dates are not recorded payments.</Typography>
      </Card>
    </ScrollView>
  );
}
