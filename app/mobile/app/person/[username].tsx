import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import { Button, Empty, IconButton, SectionHeader, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function PersonTimelineScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const timeline = useQuery(api.groups.queries.personTimeline, username ? { username } : 'skip');
  const handle = username?.replace(/^@+/, '') ?? 'person';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 180,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">@{handle}</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">Shared balance</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">Across shared groups</Typography>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} onPress={() => router.push('/split/new' as never)}>
          Split expense
        </Button>
        <Button
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push(`/settle/${handle}` as never)}
        >
          Settle
        </Button>
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="Between you" />
        {timeline && timeline.length > 0 ? (
          timeline.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              title={transaction.title}
              category="Shared expense"
              account="Group"
              amountMinor={transaction.amountMinor}
              currency={transaction.currency}
              type={transaction.type}
              date={new Date(transaction.occurredAt).toLocaleDateString()}
            />
          ))
        ) : (
          <Empty
            title="Nothing shared yet."
            description="Expenses between you will appear here, grouped across your shared groups."
          />
        )}
      </View>
    </ScrollView>
  );
}
