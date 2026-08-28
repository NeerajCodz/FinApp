import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, ArrowLeftRight, MoreHorizontal, Plus } from '@/lib/icons';
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
        paddingBottom: insets.bottom + 32,
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

      <View
        style={{
          padding: 20,
          gap: 7,
          borderRadius: 22,
          backgroundColor: tokens.surfaceSubtle,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
        }}
      >
        <Typography variant="label">Your balance</Typography>
        <Money amountMinor={0n} currency={group?.currency ?? 'INR'} size="display" />
        <Typography variant="caption">All settled</Typography>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          size="lg"
          style={{ flex: 1 }}
          onPress={() => router.push(`/group/${id}/expenses/new` as never)}
        >
          <Plus size={18} color={tokens.primaryForeground} />
          <Text
            style={{
              marginLeft: 8,
              color: tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Expense
          </Text>
        </Button>
        <Button
          size="lg"
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push('/settle/new' as never)}
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
        <SectionHeader title="People" />
        {group?.members && group.members.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16 }}
          >
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                accessibilityRole={member.username ? 'button' : undefined}
                accessibilityLabel={
                  member.username
                    ? `Open @${member.username}`
                    : member.displayName
                }
                activeOpacity={member.username ? 0.72 : 1}
                disabled={!member.username}
                onPress={() =>
                  member.username && router.push(`/person/${member.username}` as never)
                }
                style={{ alignItems: 'center', gap: 7, width: 96 }}
              >
                <Avatar
                  initials={member.displayName.slice(0, 2)}
                  label={member.displayName}
                  size={48}
                />
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  style={{
                    maxWidth: 96,
                    textAlign: 'center',
                    color: member.username ? tokens.foregroundMuted : tokens.foregroundSubtle,
                  }}
                >
                  {member.username ? `@${member.username}` : member.displayName}
                </Typography>
              </TouchableOpacity>
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
