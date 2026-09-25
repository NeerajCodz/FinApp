import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { formatMinor } from '@/lib/money';

export default function BalancesScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { group, ledger, error, loading, refreshing, retry, userId } = useGroupLedger(id);
  const balance = userId ? ledger?.balances[userId] ?? 0n : 0n;
  const entries = ledger ? [...ledger.names].map(([memberId, name]) => ({
    id: memberId, name: memberId === userId ? 'You' : name,
    amountMinor: ledger.balances[memberId] ?? 0n,
  })) : [];
  const settled = ledger && Object.values(ledger.balances).every((amount) => amount === 0n);
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 28 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
      <Typography variant="title">Balances</Typography>
    </View>
    {!id ? <Empty title="Missing group ID" description="Open balances from a group." />
      : !group && !loading ? <Empty title="Group unavailable" description="This group is not saved on this device." />
      : error ? <View style={{ gap: 12 }} accessibilityRole="alert">
        <Empty title="Balances unavailable" description="The complete group ledger could not be loaded. No partial balance is shown." />
        <Button onPress={retry}>Retry</Button>
      </View>
      : loading || !ledger ? <Typography variant="heading">Loading all-time balances…</Typography>
      : <>
        {refreshing && <Typography variant="caption">Refreshing group records…</Typography>}
        <View style={{ gap: 8 }}>
          <Typography variant="label">Your balance · {String(group?.name ?? 'Group')}</Typography>
          <Money amountMinor={balance} currency={ledger.currency} size="display" />
          <Typography variant="caption">{balance > 0n ? 'Owed to you' : balance < 0n ? 'You owe' : 'You are settled'}</Typography>
        </View>
        {settled ? <Empty title="All settled" description="Every member has a zero balance." /> : <View style={{ gap: 16 }}>
          <Typography variant="heading">Members</Typography>
          {entries.map((member) => <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 }}>
            <View style={{ flex: 1 }}>
              <Typography variant="small" numberOfLines={2}>{member.name}</Typography>
              <Typography variant="caption">{member.amountMinor > 0n ? 'Is owed' : member.amountMinor < 0n ? 'Owes' : 'Settled'}</Typography>
            </View>
            <Typography variant="small" style={{ fontVariant: ['tabular-nums'] }}>{formatMinor(member.amountMinor, ledger.currency)}</Typography>
          </View>)}
        </View>}
      </>}
  </ScrollView>;
}
