import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocalGroupRange, useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
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
  const { userId, fetchGroupRange } = useLocalSync();
  const { data: groups } = useLocalRecords<Record<string, unknown>>(userId, 'group');
  const { data: groupMembers } = useLocalRecords<Record<string, unknown>>(userId, 'groupMember');
  const startAt = React.useMemo(() => Date.now() - 90 * 24 * 60 * 60 * 1000, []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const group = groups?.find((record) => String(record.id ?? record._id) === id);
  const { transactions } = useLocalGroupRange<Record<string, unknown>>(
    userId,
    id ?? null,
    startAt,
    endAt,
    fetchGroupRange,
  );
  const expenses = transactions?.filter((record) => String(record.groupId) === id) ?? [];
  const members = groupMembers?.filter((record) => String(record.groupId) === id) ?? [];

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
          {String(group?.name ?? 'Group')}
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
        <Money amountMinor={0n} currency={String(group?.currency ?? 'INR')} size="display" />
        <Typography variant="caption">All settled</Typography>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          size="lg"
          style={{ flex: 1 }}
          onPress={() => router.push(`/group/${id}/expenses/new` as never)}
        >
          <Plus size={18} color={tokens.primaryForeground} />
          <Text style={{ marginLeft: 8, color: tokens.primaryForeground, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15 }}>
            Expense
          </Text>
        </Button>
        <Button size="lg" style={{ flex: 1 }} variant="outline" onPress={() => router.push('/settle/new' as never)}>
          <ArrowLeftRight size={18} color={tokens.foreground} />
          <Text style={{ marginLeft: 8, color: tokens.foreground, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15 }}>
            Settle
          </Text>
        </Button>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="People" />
        {members.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {members.map((member) => {
              const displayName = String(member.displayName ?? member.name ?? member.username ?? 'Member');
              const username = typeof member.username === 'string' ? member.username : undefined;
              const memberId = String(member.id ?? member.memberId ?? member._id ?? displayName);
              return (
                <TouchableOpacity
                  key={memberId}
                  accessibilityRole={username ? 'button' : undefined}
                  accessibilityLabel={username ? `Open @${username}` : displayName}
                  activeOpacity={username ? 0.72 : 1}
                  disabled={!username}
                  onPress={() => username && router.push(`/person/${username}` as never)}
                  style={{ alignItems: 'center', gap: 7, width: 96 }}
                >
                  <Avatar initials={displayName.slice(0, 2)} label={displayName} size={48} />
                  <Typography
                    variant="caption"
                    numberOfLines={1}
                    style={{ maxWidth: 96, textAlign: 'center', color: username ? tokens.foregroundMuted : tokens.foregroundSubtle }}
                  >
                    {username ? `@${username}` : displayName}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>Invite people by @username or phone number.</Text>
        )}
      </View>

      <Separator />
      <View style={{ gap: 12 }}>
        <SectionHeader title="Recent" />
        {expenses.length > 0 ? (
          expenses.map((expense) => (
            <TransactionRow
              key={String(expense.id ?? expense._id ?? '')}
              title={String(expense.title ?? 'Group expense')}
              category="Group expense"
              account={String(group?.name ?? 'Group')}
              amountMinor={expense.amountMinor as bigint}
              currency={String(expense.currency ?? group?.currency ?? 'INR')}
              type="expense"
              date={new Date(Number(expense.occurredAt ?? Date.now())).toLocaleDateString()}
            />
          ))
        ) : (
          <Empty title="No shared records." description="Expenses and settlements will appear here." />
        )}
      </View>
    </ScrollView>
  );
}
