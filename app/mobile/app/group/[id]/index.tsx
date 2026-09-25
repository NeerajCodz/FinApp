import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { ArrowLeft, Gear, Plus, ReceiptText, UsersThree } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import { Avatar, Button, Empty, IconButton, SectionHeader, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { recordId, recordIds } from '@/lib/ledger';

export default function GroupHomeScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { group, members, ledger, error, loading, retry, userId } = useGroupLedger(id);
  const groupMembers = members?.filter((record) => typeof record.groupId === 'string' && recordIds(group ?? {}).includes(record.groupId)) ?? [];
  const recent = [...(ledger?.expenses ?? [])].sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt)).slice(0, 5);
  const balance = userId ? ledger?.balances[userId] ?? 0n : 0n;
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 28 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
      <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>{String(group?.name ?? 'Group')}</Typography>
      {!!id && <IconButton label="Group settings" variant="ghost"
        onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id } })}>
        <Gear size={20} color={tokens.foreground} />
      </IconButton>}
    </View>
    {!id ? <Empty title="Missing group ID" description="Open a group from your groups list." />
      : !group && error ? <Empty title="Group unavailable"
        description="Saved group data could not be loaded on this device."
        action={<Button variant="outline" onPress={retry}>Retry</Button>} />
      : !group && !loading ? <Empty title="Group unavailable" description="This group is not saved on this device." />
      : <>
        <View style={{ padding: 20, gap: 9, borderRadius: 22, backgroundColor: tokens.surfaceSubtle, borderWidth: 1, borderColor: tokens.borderSubtle }}>
          <Typography variant="label">Your balance</Typography>
          {error ? <View style={{ gap: 10 }} accessibilityRole="alert">
            <Typography variant="small">Complete group balances are unavailable. No partial value is shown.</Typography>
            <Button onPress={retry}>Retry</Button>
          </View> : loading || !ledger ? <Typography variant="small">Loading all-time balance…</Typography> : <>
            <Money amountMinor={balance} currency={ledger.currency} size="display" />
            <Typography variant="caption">{balance > 0n ? 'Owed to you' : balance < 0n ? 'You owe' : 'You are settled'}</Typography>
            <Button variant="outline" onPress={() => router.push({ pathname: '/group/[id]/balances', params: { id: id! } })}>View member balances</Button>
            {balance !== 0n && <Button variant="outline"
              onPress={() => router.push({ pathname: '/settle/new', params: { groupId: id! } })}>
              Record a settlement
            </Button>}
          </>}
        </View>
        <Button size="lg" onPress={() => router.push({ pathname: '/group/[id]/expenses/new', params: { id: id! } })}>
          <Plus size={18} color={tokens.primaryForeground} />
          <Text style={{ marginLeft: 8, color: tokens.primaryForeground, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15 }}>Add expense</Text>
        </Button>
        <View style={{ gap: 12 }}>
          <SectionHeader title="People" />
          {groupMembers.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {groupMembers.map((member) => {
              const displayName = String(member.displayName ?? member.name ?? member.username ?? 'Member');
              const username = typeof member.username === 'string' ? member.username : undefined;
              const memberId = String(member.id ?? member.userId ?? member._id ?? displayName);
              return <TouchableOpacity key={memberId} accessibilityRole={username ? 'button' : undefined}
                accessibilityLabel={username ? `Open @${username}` : displayName} activeOpacity={username ? 0.72 : 1}
                disabled={!username} onPress={() => username && router.push(`/person/${username}` as never)}
                style={{ alignItems: 'center', gap: 7, width: 96 }}>
                <Avatar initials={displayName.slice(0, 2)} label={displayName} size={48} />
                <Typography variant="caption" numberOfLines={1} style={{ maxWidth: 96, textAlign: 'center', color: username ? tokens.foregroundMuted : tokens.foregroundSubtle }}>
                  {username ? `@${username}` : displayName}
                </Typography>
              </TouchableOpacity>;
            })}
          </ScrollView> : <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
            <UsersThree size={26} color={tokens.foregroundMuted} />
            <Typography variant="bodyLarge">No members saved</Typography>
            <Typography variant="small" style={{ textAlign: 'center' }}>
              Members invited to this group will appear here.
            </Typography>
          </View>}
        </View>
        <Separator />
        <View style={{ gap: 12 }}>
          <SectionHeader title="Recent" />
          {recent.length > 0 ? recent.map((expense) => {
            const transactionId = recordId(expense);
            return <TransactionRow key={transactionId} title={String(expense.title ?? 'Group expense')}
              category="Group expense" account={String(group?.name ?? 'Group')}
              amountMinor={expense.amountMinor as bigint} currency={ledger!.currency} type="expense" semanticType="split"
              date={new Date(Number(expense.occurredAt)).toLocaleDateString()}
              onPress={transactionId ? () => router.push({ pathname: '/transaction/[id]', params: { id: transactionId } }) : undefined} />;
          }) : <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
            <ReceiptText size={28} color={tokens.foregroundMuted} />
            <Typography variant="bodyLarge">No shared expenses</Typography>
            <Typography variant="small" style={{ textAlign: 'center' }}>
              Add an expense to start your group history.
            </Typography>
            <Button size="sm" variant="outline"
              onPress={() => router.push({ pathname: '/group/[id]/expenses/new', params: { id: id! } })}>
              Add expense
            </Button>
          </View>}
        </View>
      </>}
  </ScrollView>;
}
