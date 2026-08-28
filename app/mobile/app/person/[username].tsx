import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowLeftRight, UsersThree } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import { Avatar, Button, Empty, IconButton, SectionHeader, Text, Typography } from '@/components/ui';
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
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">Person</Typography>
      </View>

      <View
        style={{
          padding: 20,
          gap: 18,
          borderRadius: 22,
          backgroundColor: tokens.surfaceSubtle,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar
            initials={handle.slice(0, 2).toUpperCase()}
            label={`@${handle}`}
            size={60}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="heading">@{handle}</Typography>
            <Typography variant="small">Shared money timeline</Typography>
          </View>
        </View>
        <View
          style={{
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: tokens.borderSubtle,
            gap: 5,
          }}
        >
          <Typography variant="label">Shared balance</Typography>
          <Money amountMinor={0n} currency="INR" size="display" />
          <Typography variant="caption">Across shared groups</Typography>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button size="lg" style={{ flex: 1 }} onPress={() => router.push('/split/new' as never)}>
          <UsersThree size={18} color={tokens.primaryForeground} />
          <Text
            style={{
              marginLeft: 8,
              color: tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Split
          </Text>
        </Button>
        <Button
          size="lg"
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push(`/settle/${handle}` as never)}
        >
          <ArrowLeftRight size={18} color={tokens.foreground} />
          <Text
            style={{
              marginLeft: 8,
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Settle
          </Text>
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
