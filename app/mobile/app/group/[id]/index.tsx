import React from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, MoreHorizontal } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import {
  Avatar,
  Button,
  Empty,
  IconButton,
  SectionHeader,
  Separator,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const group = useQuery(api.groups.queries.detail, id ? { groupId: id as never } : 'skip');
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
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {group?.name ?? 'Group'}
        </Typography>
        <IconButton label="Group options" variant="ghost">
          <MoreHorizontal size={20} color={tokens.foreground} />
        </IconButton>
      </View>

      <View style={{ gap: 8 }}>
        <Typography variant="label">Your balance</Typography>
        <Money amountMinor={0n} currency={group?.currency ?? 'INR'} size="display" />
        <Typography variant="caption">All settled</Typography>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} onPress={() => router.push(`/group/${id}/expenses` as never)}>
          Add expense
        </Button>
        <Button
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push('/settle/new' as never)}
        >
          Settle
        </Button>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="People" />
        {group?.members && group.members.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16 }}
          >
            {group.members.map((member) => (
              <View key={member.id} style={{ alignItems: 'center', gap: 6, width: 60 }}>
                <Avatar
                  initials={member.displayName.slice(0, 2)}
                  label={member.displayName}
                  size={44}
                />
                <Typography variant="caption" numberOfLines={1}>
                  {member.username ? `@${member.username}` : member.displayName}
                </Typography>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>
            Invite people by @username or phone number.
          </Text>
        )}
      </View>

      <Separator />
      <View style={{ gap: 12 }}>
        <SectionHeader title="Recent" />
        {group?.expenses && group.expenses.length > 0 ? (
          group.expenses.map((expense) => (
            <TransactionRow
              key={expense._id}
              title={expense.title}
              category="Group expense"
              account={group.name}
              amountMinor={expense.amountMinor}
              currency={expense.currency}
              type="expense"
              date={new Date(expense.occurredAt).toLocaleDateString()}
            />
          ))
        ) : (
          <Empty
            title="No shared records."
            description="Expenses and settlements will appear here."
          />
        )}
      </View>
    </ScrollView>
  );
}
