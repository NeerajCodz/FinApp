import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, CaretRight, Plus, Wallet } from '@/lib/icons';
import { router } from 'expo-router';
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
  archivedAt?: number; completedAt?: number; targetDate?: number;
};
type Contribution = LocalRecord & { goalId: string; amountMinor: bigint };

export default function GoalsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const contributions = useLocalRecords<Contribution>(userId, 'goalContribution');
  const profiles = useLocalRecords<LocalRecord>(userId, 'profile');
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const preferredCurrency = profiles.data?.[0]?.defaultCurrency ?? settings.data?.[0]?.currency;
  const currency = typeof preferredCurrency === 'string' ? preferredCurrency : null;
  const active = goals.data?.filter((goal) => goal.archivedAt === undefined)
    .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || a.name.localeCompare(b.name));
  const saved = new Map<string, bigint>();
  for (const contribution of contributions.data ?? [])
    saved.set(contribution.goalId, (saved.get(contribution.goalId) ?? 0n) + BigInt(contribution.amountMinor));
  const currencies = new Set(active?.map((goal) => goal.currency) ?? []);
  const total = currencies.size === 1 ? active!.reduce((sum, goal) =>
    sum + (saved.get(goal.id) ?? saved.get(String(goal._id)) ?? 0n), 0n) : null;
  const loading = goals.loading || contributions.loading || profiles.loading || settings.loading;
  const loadError = goals.error || contributions.error || profiles.error || settings.error;

  async function createGoal() {
    if (!userId || !currency || saving || !name.trim()) return;
    let targetAmountMinor: bigint;
    try {
      targetAmountMinor = parseMinor(target, currency);
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target.');
    } catch { setError('Enter a valid positive target amount.'); return; }
    setSaving(true);
    setError('');
    try {
      const now = Date.now();
      await commitLocalWrite(userId, 'goal', 'goal.create',
        { ownerId: userId, name: name.trim(), targetAmountMinor, currency,
          createdAt: now, updatedAt: now },
        { name: name.trim(), targetAmountMinor, currency });
      setAdding(false); setName(''); setTarget('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this goal.');
    } finally { setSaving(false); }
  }

  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
      paddingBottom: insets.bottom + 32, gap: 24, flexGrow: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="title" style={{ flex: 1 }}>Goals</Typography>
      {!loading && active && !adding && <IconButton label="Add goal" variant="ghost" onPress={() => setAdding(true)}>
        <Plus size={21} color={tokens.foreground} />
      </IconButton>}
    </View>
    {!loading && active && active.length > 0 && <View style={{ gap: 8 }}>
      <Typography variant="label">Saved toward {active.length} {active.length === 1 ? 'goal' : 'goals'}</Typography>
      {currencies.size === 1 && total !== null ? <Money amountMinor={total} currency={active[0]!.currency} size="display" /> :
        <Typography variant="heading">Across {currencies.size} currencies</Typography>}
      <Typography variant="small">Contributions recorded separately from your account balance.</Typography>
    </View>}
    {loadError && <View style={{ gap: 10 }} accessibilityRole="alert">
      <Text style={{ color: tokens.destructive }}>Saved goals could not be loaded.</Text>
      <Button variant="outline" onPress={() => { goals.retry(); contributions.retry(); profiles.retry(); settings.retry(); }}>Retry</Button>
    </View>}
    {loading && !loadError && <Typography variant="small">Loading saved goals…</Typography>}
    {!loading && active?.length === 0 && !loadError && <View style={{ flex: 1, minHeight: 300,
      alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }}>
      <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: tokens.surfaceRaised,
        alignItems: 'center', justifyContent: 'center' }}><Wallet size={32} color={tokens.primary} /></View>
      <Typography variant="heading" style={{ textAlign: 'center' }}>No goals yet</Typography>
      <Text style={{ color: tokens.foregroundMuted, textAlign: 'center', maxWidth: 280 }}>
        Set a target and track each contribution in one place.
      </Text>
      {!adding && currency && <Button onPress={() => setAdding(true)}>Create a goal</Button>}
      {!currency && <Typography variant="small" style={{ textAlign: 'center' }}>
        Choose a default currency in settings before creating a goal.
      </Typography>}
      {!currency && <Button variant="outline" onPress={() => router.push('/settings/currency')}>
        Set default currency
      </Button>}
      {!isConnected && <Typography variant="small">Offline · showing saved goals</Typography>}
    </View>}
    {!loading && active && active.length > 0 && <View style={{ gap: 6 }}>
      <Typography variant="label">Your goals</Typography>
      {active.map((goal) => {
        const amount = saved.get(goal.id) ?? saved.get(String(goal._id)) ?? 0n;
        const percent = goal.targetAmountMinor > 0n
          ? Number((amount * 100n) / BigInt(goal.targetAmountMinor)) : 0;
        return <TouchableOpacity key={goal.id} accessibilityRole="button"
          accessibilityLabel={`${goal.name}, ${percent}% of target saved`}
          onPress={() => router.push(`/goals/${goal.id}` as never)} activeOpacity={0.65}
          style={{ paddingVertical: 16, gap: 9, borderBottomWidth: 1,
            borderColor: tokens.borderSubtle }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyLarge">{goal.name}</Typography>
              <Typography variant="small">{percent >= 100 ? 'Target reached' :
                goal.targetDate ? `Target ${new Date(goal.targetDate).toLocaleDateString()}` : 'No target date'}</Typography>
            </View>
            <Money amountMinor={amount} currency={goal.currency} />
            <CaretRight size={17} color={tokens.foregroundSubtle} />
          </View>
          <Progress value={Math.min(100, Math.max(0, percent))} color={tokens.primary} />
          <Typography variant="caption">{percent}% of {formatMinor(BigInt(goal.targetAmountMinor), goal.currency)}</Typography>
        </TouchableOpacity>;
      })}
    </View>}
    {adding && <View style={{ gap: 14, paddingTop: 16, borderTopWidth: 1, borderColor: tokens.borderSubtle }}>
      <Typography variant="heading">New goal</Typography>
      <Input placeholder="What are you saving for?" value={name} onChangeText={setName} />
      <Input placeholder={currency ? `Target amount · ${currency}` : 'Loading currency…'}
        keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="outline" onPress={() => { setAdding(false); setError(''); }}>Cancel</Button>
        <Button style={{ flex: 1 }} disabled={saving || !currency || !name.trim() || !target.trim()}
          onPress={() => void createGoal()}>{saving ? 'Saving…' : 'Save goal'}</Button>
      </View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Text>}
  </ScrollView>;
}
