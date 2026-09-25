import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Wallet } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, IconButton, Input, Progress, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { formatMinor, parseMinor } from '@/lib/money';
import type { LocalRecord } from '@/local/repository';

type Goal = LocalRecord & {
  id: string; name: string; targetAmountMinor: bigint; currency: string;
  targetDate?: number; completedAt?: number; archivedAt?: number;
};
type Contribution = LocalRecord & {
  id: string; goalId: string; amountMinor: bigint; occurredAt: number;
};

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const contributions = useLocalRecords<Contribution>(userId, 'goalContribution');
  const [amount, setAmount] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const goal = goals.data?.find((item) => item.id === id || item._id === id);
  const history = contributions.data?.filter((entry) =>
    entry.goalId === goal?.id || entry.goalId === goal?._id)
    .sort((a, b) => b.occurredAt - a.occurredAt) ?? [];
  const saved = history.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n);
  const percent = goal && goal.targetAmountMinor > 0n
    ? Number(saved * 100n / BigInt(goal.targetAmountMinor)) : 0;

  async function contribute() {
    if (!userId || !goal || saving) return;
    let amountMinor: bigint;
    try { amountMinor = parseMinor(amount, goal.currency); }
    catch { setError('Enter a valid amount.'); return; }
    if (amountMinor <= 0n) { setError('Enter a positive amount.'); return; }
    setSaving(true); setError('');
    try {
      const now = Date.now();
      await commitLocalWrite(userId, 'goalContribution', 'goal.contribute',
        { goalId: goal.id, ownerId: userId, amountMinor, currency: goal.currency,
          occurredAt: now, createdAt: now },
        { goalId: goal.id, amountMinor },
        { dependencies: goal.id.startsWith('local-') ? [`goal:${goal.id}`] : [] });
      setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record contribution.');
    } finally { setSaving(false); }
  }

  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
      paddingBottom: insets.bottom + 32, gap: 25 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="heading">Goal</Typography>
    </View>
    {(goals.loading || contributions.loading) && <Typography variant="small">Loading goal…</Typography>}
    {(goals.error || contributions.error) && <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.destructive }}>Saved goal details could not be loaded.</Text>
      <Button variant="outline" onPress={() => { goals.retry(); contributions.retry(); }}>Retry</Button>
    </View>}
    {!goals.loading && !contributions.loading && !goals.error && !contributions.error &&
      (!goal || goal.archivedAt !== undefined) &&
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 80 }}>
        <Wallet size={32} color={tokens.foregroundMuted} />
        <Typography variant="heading">Goal unavailable</Typography>
        <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
          It may have been archived or is not saved on this device.
        </Text>
      </View>}
    {goal && !goals.loading && !contributions.loading && !goals.error && !contributions.error && <>
      <View style={{ gap: 8 }}>
        <Typography variant="title">{goal.name}</Typography>
        <Typography variant="label">Saved so far</Typography>
        <Money amountMinor={saved} currency={goal.currency} size="display" />
        <Text style={{ color: tokens.foregroundMuted }}>of {formatMinor(BigInt(goal.targetAmountMinor), goal.currency)} target</Text>
        <Progress value={Math.min(100, Math.max(0, percent))} color={tokens.primary} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="caption">{percent}% reached</Typography>
          <Typography variant="caption">{goal.targetDate ?
            new Date(goal.targetDate).toLocaleDateString() : 'No target date'}</Typography>
        </View>
      </View>
      <View style={{ gap: 12, paddingTop: 18, borderTopWidth: 1, borderColor: tokens.borderSubtle }}>
        <Typography variant="heading">Record a contribution</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          This tracks progress; it does not move money between accounts.
        </Text>
        <Input placeholder={`Amount · ${goal.currency}`} keyboardType="decimal-pad"
          value={amount} onChangeText={setAmount} />
        <Button disabled={saving || !amount.trim()} onPress={() => void contribute()}>
          {saving ? 'Saving…' : 'Add contribution'}
        </Button>
      </View>
      <View style={{ gap: 10 }}>
        <Typography variant="heading">History</Typography>
        {history.length === 0 ? <Text style={{ color: tokens.foregroundMuted }}>
          No contributions recorded yet.
        </Text> : history.map((entry) => <View key={entry.id}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 13, borderBottomWidth: 1, borderColor: tokens.borderSubtle }}>
          <Typography variant="small">{new Date(entry.occurredAt).toLocaleDateString()}</Typography>
          <Money amountMinor={BigInt(entry.amountMinor)} currency={goal.currency} />
        </View>)}
      </View>
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Text>}
  </ScrollView>;
}
