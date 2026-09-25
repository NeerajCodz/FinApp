import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, CalendarDays, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';
import { Button, IconButton, Input, Text, Typography } from '@/components/ui';
import { Money } from '@/components/finance';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { parseMinor } from '@/lib/money';
import type { LocalRecord } from '@/local/repository';

type Rule = LocalRecord & {
  id: string; name: string; frequency: Recurrence; interval: number;
  nextOccurrence: number; enabled: boolean; autoCreate: boolean;
  template: { amountMinor?: bigint; currency?: string };
};
type Account = LocalRecord & { id: string; name: string; currency: string; archivedAt?: number };
const frequencyOptions = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export default function RecurringScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const rules = useLocalRecords<Rule>(userId, 'recurringRule');
  const accounts = useLocalRecords<Account>(userId, 'account');
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [frequency, setFrequency] = React.useState<(typeof frequencyOptions)[number]>('monthly');
  const [accountId, setAccountId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const activeAccounts = accounts.data?.filter((account) => account.archivedAt === undefined);
  const selected = activeAccounts?.find((account) => account.id === accountId);
  const ordered = rules.data?.slice().sort((a, b) => a.nextOccurrence - b.nextOccurrence);
  const enabled = ordered?.filter((rule) => rule.enabled) ?? [];
  const now = Date.now();
  const first = enabled.map((rule) => {
    let date = rule.nextOccurrence;
    for (let i = 0; date <= now && i < 1024; i++) date = nextOccurrence(date, rule.frequency, rule.interval);
    return date;
  }).filter((date) => date > now).sort((a, b) => a - b)[0];

  async function createRule() {
    if (!userId || !selected || !name.trim() || saving) return;
    let amountMinor: bigint;
    try { amountMinor = parseMinor(amount, selected.currency); }
    catch { setError('Enter a valid amount.'); return; }
    if (amountMinor <= 0n) { setError('Enter a positive amount.'); return; }
    setSaving(true); setError('');
    try {
      const now = Date.now();
      const due = now + 86_400_000;
      await commitLocalWrite(userId, 'recurringRule', 'recurring.create',
        { ownerId: userId, name: name.trim(),
          template: { type: 'expense', title: name.trim(), amountMinor,
            accountId: selected.id, currency: selected.currency },
          frequency, interval: 1, nextOccurrence: due, autoCreate: false,
          reminderSettings: { enabled: true }, enabled: true, createdAt: now, updatedAt: now },
        { name: name.trim(), amountMinor, currency: selected.currency,
          accountId: selected.id, frequency, nextOccurrence: due },
        { dependencies: selected.id.startsWith('local-') ? [`account:${selected.id}`] : [] });
      setAdding(false); setName(''); setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create reminder.');
    } finally { setSaving(false); }
  }

  async function toggle(rule: Rule) {
    if (!userId || saving) return;
    setSaving(true); setError('');
    try {
      await commitLocalWrite(userId, 'recurringRule', 'recurring.setEnabled',
        { ...rule, enabled: !rule.enabled },
        { ruleId: rule.id, enabled: !rule.enabled },
        { recordId: rule.id, dependencies: rule.id.startsWith('local-') ? [`recurringRule:${rule.id}`] : [] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update reminder.'); }
    finally { setSaving(false); }
  }

  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
      paddingBottom: insets.bottom + 32, gap: 24, flexGrow: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="title" style={{ flex: 1 }}>Recurring</Typography>
      {ordered && !adding && <IconButton label="Add recurring reminder" variant="ghost"
        onPress={() => setAdding(true)}><Plus size={21} color={tokens.foreground} /></IconButton>}
    </View>
    <Text style={{ color: tokens.foregroundMuted, maxWidth: 340 }}>
      Reminder-only rules keep upcoming expenses visible. They never create a transaction automatically.
    </Text>
    {rules.error || accounts.error ? <View style={{ gap: 10 }} accessibilityRole="alert">
      <Text style={{ color: tokens.destructive }}>Saved recurring rules could not be loaded.</Text>
      <Button variant="outline" onPress={() => { rules.retry(); accounts.retry(); }}>Retry</Button>
    </View> : (rules.loading || accounts.loading) && <Typography variant="small">Loading saved reminders…</Typography>}
    {ordered && ordered.length > 0 && <View style={{ gap: 6 }}>
      <Typography variant="label">{enabled.length} active · {ordered.length - enabled.length} paused</Typography>
      {first && <Typography variant="heading">Next due {new Date(first).toLocaleDateString()}</Typography>}
      {ordered.map((rule) => {
        const template = rule.template;
        let upcoming = rule.nextOccurrence;
        for (let i = 0; upcoming <= now && i < 1024; i++)
          upcoming = nextOccurrence(upcoming, rule.frequency, rule.interval);
        return <View key={rule.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 16, borderBottomWidth: 1, borderColor: tokens.borderSubtle }}>
          <View style={{ width: 42, height: 42, borderRadius: 14,
            backgroundColor: tokens.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={20} color={tokens.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Typography variant="bodyLarge">{rule.name}</Typography>
            <Typography variant="small">{rule.enabled ?
              `${rule.frequency} · ${upcoming > now ? new Date(upcoming).toLocaleDateString() : 'due'}` :
              'Paused'} · Reminder only</Typography>
            {template?.amountMinor !== undefined && template.currency &&
              <Money amountMinor={BigInt(template.amountMinor)} currency={template.currency} />}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name}`}
            disabled={saving} onPress={() => void toggle(rule)} activeOpacity={0.6}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Typography variant="small" style={{ color: tokens.primary }}>
              {rule.enabled ? 'Pause' : 'Resume'}
            </Typography>
          </TouchableOpacity>
        </View>;
      })}
    </View>}
    {ordered?.length === 0 && !rules.error && <View style={{ flex: 1, minHeight: 300,
      alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }}>
      <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: tokens.surfaceRaised,
        alignItems: 'center', justifyContent: 'center' }}><CalendarDays size={32} color={tokens.primary} /></View>
      <Typography variant="heading" style={{ textAlign: 'center' }}>Nothing scheduled</Typography>
      <Text style={{ color: tokens.foregroundMuted, textAlign: 'center', maxWidth: 280 }}>
        Add a reminder for a repeating expense. You decide when to record it.
      </Text>
      {!adding && <Button onPress={() => setAdding(true)}>Add reminder</Button>}
      {!isConnected && <Typography variant="small">Offline · showing saved rules</Typography>}
    </View>}
    {adding && <View style={{ gap: 14, paddingTop: 16, borderTopWidth: 1, borderColor: tokens.borderSubtle }}>
      <Typography variant="heading">New reminder</Typography>
      <Input placeholder="Expense name" value={name} onChangeText={setName} />
      <Typography variant="label">Account</Typography>
      {activeAccounts?.length === 0 && <Button variant="outline" onPress={() => router.push('/account/new')}>
        Add an account first
      </Button>}
      {activeAccounts?.map((account) => <Button key={account.id} size="sm"
        variant={accountId === account.id ? 'secondary' : 'outline'}
        onPress={() => setAccountId(account.id)} style={{ justifyContent: 'flex-start' }}>
        {account.name} · {account.currency}
      </Button>)}
      <Input placeholder={selected ? `Amount · ${selected.currency}` : 'Choose an account first'}
        keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Typography variant="label">Repeat from tomorrow</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {frequencyOptions.map((option) => <Button key={option} size="sm"
          variant={option === frequency ? 'secondary' : 'outline'} onPress={() => setFrequency(option)}>
          {option}
        </Button>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="outline" onPress={() => { setAdding(false); setError(''); }}>Cancel</Button>
        <Button style={{ flex: 1 }} disabled={saving || !selected || !name.trim() || !amount.trim()}
          onPress={() => void createRule()}>{saving ? 'Saving…' : 'Save reminder'}</Button>
      </View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Text>}
  </ScrollView>;
}
