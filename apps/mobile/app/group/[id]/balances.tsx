import React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { simplifyDebts } from '@convex/splits/domain';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IllustratedState,
  MemberBalanceBars,
  NetPositionHero,
  SectionTitle,
  SettleCard,
  SuggestedTransfers,
  type SettlePerson,
} from '@finapp/ui/finance';
import { Button, IconButton, ListSkeleton, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens, space } from '@finapp/ui/tokens';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { recordIds } from '@/lib/ledger';

export default function BalancesScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected } = useLocalSync();
  const { group, members, ledger, error, loading, refreshing, retry, userId } = useGroupLedger(id);
  const cloudGroupId = String(group?.cloudId ?? group?._id ?? '');
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const balance = userId ? (ledger?.balances[userId] ?? 0n) : 0n;
  const groupIds = recordIds(group ?? {});
  const localMember = (memberId: string) =>
    members?.find(
      (member) =>
        typeof member.groupId === 'string' &&
        groupIds.includes(member.groupId) &&
        (member.userId ?? member.memberId) === memberId,
    );
  const people: SettlePerson[] = ledger
    ? Object.keys(ledger.balances).map((memberId) => {
        const remote = remoteGroup?.members.find((member) => member.id === memberId);
        const former = remoteGroup?.formerMembers.find((member) => member.id === memberId);
        const local = localMember(memberId);
        const named = ledger.names.get(memberId);
        return {
          id: memberId,
          name:
            memberId === userId
              ? 'You'
              : (remote?.displayName ??
                (named && !named.startsWith('Member ') ? named : undefined) ??
                former?.displayName ??
                named ??
                `Member ${memberId.slice(-6)}`),
          avatarUrl:
            remote?.avatarUrl ?? (typeof local?.avatarUrl === 'string' ? local.avatarUrl : null),
          avatarId:
            remote?.avatarId ??
            former?.avatarId ??
            (typeof local?.avatarId === 'string' ? local.avatarId : undefined),
          leftAt: remote ? undefined : former?.leftAt,
        };
      })
    : [];
  const transfers = ledger ? simplifyDebts(ledger.balances) : [];
  const settled = !!ledger && Object.values(ledger.balances).every((amount) => amount === 0n);
  const settleWith = (memberId?: string) =>
    router.push({
      pathname: '/settle/new',
      params: { groupId: id ?? '', ...(memberId ? { member: memberId } : {}) },
    });
  return (
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
          <Typography variant="title">Balances</Typography>
          {!!group && (
            <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
              {String(group.name ?? 'Group')}
              {refreshing ? ' · refreshing…' : ''}
            </Typography>
          )}
        </View>
      </View>
      {!id || (!group && !loading) ? (
        <IllustratedState
          scene="group"
          title="Group unavailable"
          description="This group is not saved on this device. Open it from your groups list."
        />
      ) : error ? (
        <IllustratedState
          scene="offline"
          title="Balances unavailable"
          description="The complete group ledger could not be loaded. No partial balance is shown."
          action={<Button onPress={retry}>Retry</Button>}
        />
      ) : loading || !ledger ? (
        <SettleCard>
          <ListSkeleton rows={4} />
        </SettleCard>
      ) : (
        <>
          <NetPositionHero
            balanceMinor={balance}
            currency={ledger.currency}
            title={String(group?.name ?? 'Group')}
            people={people.filter((person) => !person.leftAt)}
          >
            {balance !== 0n && <Button onPress={() => settleWith()}>Settle up</Button>}
          </NetPositionHero>
          {settled ? (
            <IllustratedState
              scene="allSettled"
              title="All settled"
              description="Every member has a zero balance. Nice work."
            />
          ) : (
            <>
              <SettleCard>
                <SectionTitle
                  title="Members"
                  caption="Tap someone you owe or who owes you to settle."
                />
                <MemberBalanceBars
                  balances={ledger.balances}
                  currency={ledger.currency}
                  people={people}
                  meId={userId}
                  onPressMember={(memberId) => {
                    const theirs = ledger.balances[memberId] ?? 0n;
                    if (balance !== 0n && (balance < 0n ? theirs > 0n : theirs < 0n))
                      settleWith(memberId);
                  }}
                />
              </SettleCard>
              {transfers.length > 0 && (
                <SettleCard>
                  <SectionTitle
                    title="Suggested transfers"
                    caption="The fewest payments that settle everyone."
                  />
                  <SuggestedTransfers
                    transfers={transfers}
                    currency={ledger.currency}
                    people={people}
                    meId={userId}
                    onSettle={(transfer) =>
                      settleWith(
                        transfer.fromUserId === userId ? transfer.toUserId : transfer.fromUserId,
                      )
                    }
                  />
                </SettleCard>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
