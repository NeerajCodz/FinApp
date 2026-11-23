'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { simplifyDebts } from '@convex/splits/domain';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, ListSkeleton } from '@finapp/ui/web';
import {
  IllustratedState,
  MemberBalanceBars,
  NetPositionHero,
  SectionTitle,
  SettleCard,
  settleStyles,
  SuggestedTransfers,
  type SettlePerson,
} from '@finapp/ui/finance';
import { useGroupLedger } from '@/lib/groups/useGroupLedger';

export default function GroupBalancesPage() {
  const router = useRouter();
  const { id: routeId } = useParams<{ id: string }>();
  const ledger = useGroupLedger(routeId);
  const { userId, isConnected, group, groupId, cloudGroupId, members, balances, currency } = ledger;
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP BALANCES</p>
        <h1>Settle what is shared.</h1>
        <p>Sign in to open saved balances and repayments.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  const people: SettlePerson[] = balances
    ? Object.keys(balances).map((memberId) => {
        const remote = remoteGroup?.members.find((member) => member.id === memberId);
        const former = remoteGroup?.formerMembers.find((member) => member.id === memberId);
        const local = members.find((member) => (member.userId ?? member.memberId) === memberId);
        return {
          id: memberId,
          name:
            memberId === userId
              ? 'You'
              : (remote?.displayName ??
                local?.displayName ??
                local?.name ??
                (local?.username ? `@${local.username}` : undefined) ??
                former?.displayName ??
                `Member ${memberId.slice(-6)}`),
          avatarUrl: remote?.avatarUrl ?? local?.avatarUrl ?? null,
          avatarId: remote?.avatarId ?? local?.avatarId ?? former?.avatarId,
          leftAt: remote || local ? undefined : former?.leftAt,
        };
      })
    : [];
  const myBalance = balances?.[userId] ?? 0n;
  const transfers = balances ? simplifyDebts(balances) : [];
  const settled = !!balances && Object.values(balances).every((amount) => amount === 0n);
  const settleWith = (memberId?: string) =>
    router.push(
      `/settle/new?groupId=${encodeURIComponent(groupId)}${memberId ? `&member=${encodeURIComponent(memberId)}` : ''}`,
    );

  return (
    <main className={`${settleStyles.page} ${settleStyles.narrow}`}>
      <header className={settleStyles.heading}>
        <Link
          className={settleStyles.back}
          href={group ? `/group/${encodeURIComponent(groupId)}` : '/groups'}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1>Balances</h1>
          {group ? <p className={settleStyles.muted}>{group.name ?? 'Group'}</p> : null}
        </div>
      </header>
      {!group && !ledger.groupsLoading ? (
        <IllustratedState
          scene="group"
          title="Group unavailable"
          description="This group is not saved in this browser. Reconnect and open it from Groups."
        />
      ) : ledger.status === 'unavailable' ? (
        <IllustratedState
          scene="offline"
          title="Balances unavailable"
          description={`The complete group ledger could not be loaded. No partial balance is shown. ${ledger.error}`}
          action={
            isConnected ? (
              <Button variant="outline" onPress={ledger.retry}>
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : ledger.status === 'loading' || !balances ? (
        <SettleCard>
          <ListSkeleton rows={4} />
        </SettleCard>
      ) : (
        <>
          <NetPositionHero
            balanceMinor={myBalance}
            currency={currency}
            title={group?.name ?? 'Group'}
            people={people.filter((person) => !person.leftAt)}
          >
            {myBalance !== 0n ? <Button onPress={() => settleWith()}>Settle up</Button> : null}
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
                  caption="Select someone you owe, or who owes you, to settle."
                />
                <MemberBalanceBars
                  balances={balances}
                  currency={currency}
                  people={people}
                  meId={userId}
                  onPressMember={(memberId) => {
                    const theirs = balances[memberId] ?? 0n;
                    if (myBalance !== 0n && (myBalance < 0n ? theirs > 0n : theirs < 0n))
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
                    currency={currency}
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
    </main>
  );
}
