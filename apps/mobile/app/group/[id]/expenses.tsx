import React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft, Plus } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GroupExpenseTimeline,
  IllustratedState,
  IncludePastExpensesSheet,
  LateJoinerBanner,
  SettleCard,
} from '@finapp/ui/finance';
import { Button, IconButton, ListSkeleton, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens, space } from '@finapp/ui/tokens';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLateJoiners } from '@/hooks/useLateJoiners';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { recordId, recordIds } from '@/lib/ledger';

export default function GroupExpensesScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected } = useLocalSync();
  const { group, members, participants, ledger, error, loading, retry, userId } =
    useGroupLedger(id);
  const categories = useLocalRecords(userId, 'category');
  const cloudGroupId = String(group?.cloudId ?? group?._id ?? '');
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const groupIds = recordIds(group ?? {});
  const currentMembers = remoteGroup
    ? remoteGroup.members.map((member) => ({
        userId: member.id,
        name: member.id === userId ? 'You' : member.displayName,
        joinedAt: member.joinedAt,
        role: member.role,
      }))
    : (members ?? [])
        .filter(
          (member) =>
            member.deletedAt === undefined &&
            typeof member.groupId === 'string' &&
            groupIds.includes(member.groupId),
        )
        .map((member) => ({
          userId: String(member.userId ?? member.memberId ?? ''),
          name:
            member.userId === userId
              ? 'You'
              : String(member.displayName ?? member.name ?? member.username ?? 'Member'),
          joinedAt: typeof member.joinedAt === 'number' ? member.joinedAt : undefined,
          role: typeof member.role === 'string' ? member.role : undefined,
        }));
  const myRole = currentMembers.find((member) => member.userId === userId)?.role;
  const lateJoiners = useLateJoiners({
    cloudGroupId,
    currency: ledger?.currency ?? String(group?.currency ?? ''),
    expenses: ledger?.expenses ?? [],
    participants,
    members: currentMembers,
    meId: userId,
    isAdmin:
      (remoteGroup ? remoteGroup.ownerId === userId : group?.ownerId === userId) ||
      myRole === 'owner' ||
      myRole === 'admin',
    isConnected,
  });
  const expenses = (ledger?.expenses ?? []).map((expense) => {
    const category = categories.data?.find(
      (record) =>
        typeof expense.categoryId === 'string' && recordIds(record).includes(expense.categoryId),
    );
    return {
      id: recordId(expense),
      title: String(expense.title ?? 'Group expense'),
      amountMinor: expense.amountMinor as bigint,
      currency: ledger?.currency ?? String(group?.currency ?? ''),
      occurredAt: Number(expense.occurredAt ?? 0),
      category: typeof category?.name === 'string' ? category.name : undefined,
      icon: typeof category?.icon === 'string' ? category.icon : undefined,
      color: typeof category?.color === 'string' ? category.color : undefined,
    };
  });
  const addExpense = () => router.push({ pathname: '/group/[id]/new', params: { id: id ?? '' } });

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: layoutTokens.screenX,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          gap: space.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Typography variant="title">Expenses</Typography>
            {!!group && (
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                {String(group.name ?? 'Group')} · {expenses.length} total
              </Typography>
            )}
          </View>
          <IconButton label="Add group expense" variant="ghost" onPress={addExpense}>
            <Plus size={22} color={tokens.foreground} />
          </IconButton>
        </View>
        {lateJoiners.banners.map((joiner) => (
          <LateJoinerBanner
            key={joiner.userId}
            name={joiner.name}
            missedCount={joiner.missedCount}
            onInclude={() => lateJoiners.open(joiner.userId)}
            onDismiss={() => lateJoiners.dismiss(joiner.userId)}
          />
        ))}
        {!id || (!group && !loading) ? (
          <IllustratedState
            scene="group"
            title="Group unavailable"
            description="This group is not saved on this device."
          />
        ) : error ? (
          <IllustratedState
            scene="offline"
            title="Expenses unavailable"
            description="The group history could not be loaded completely."
            action={<Button onPress={retry}>Retry</Button>}
          />
        ) : loading || !ledger ? (
          <SettleCard>
            <ListSkeleton rows={5} />
          </SettleCard>
        ) : expenses.length ? (
          <GroupExpenseTimeline
            expenses={expenses}
            joins={lateJoiners.joins}
            onOpen={(expenseId) =>
              router.push({ pathname: '/transaction/[id]', params: { id: expenseId } })
            }
          />
        ) : (
          <IllustratedState
            scene="splitBill"
            title="No group expenses yet"
            description="Add the first expense and choose who shared it."
            action={
              <Button variant="outline" onPress={addExpense}>
                Add expense
              </Button>
            }
          />
        )}
      </ScrollView>
      <IncludePastExpensesSheet {...lateJoiners.sheet} />
    </>
  );
}
