'use client';

import React from 'react';
import { ArrowLeft, Check, Wallet } from 'lucide-react';
import { Button, IconTile, ListSkeleton } from '@finapp/ui/web';
import { formatMinor } from '../money';
import {
  settleAllMine,
  settleUpPlan,
  transferWith,
  type BalanceMap,
  type SettleTransfer,
} from '../groupSettle';
import { PersonAvatar, Tile } from './GroupUI';
import {
  IllustratedState,
  NetPositionHero,
  SectionTitle,
  SettleCard,
  SettleSuccess,
  SuggestedTransfers,
  type SettlePerson,
} from './GroupSettleParts';
import { SettlementEditor } from './SettlementEditor';
import styles from './GroupSettle.module.css';

export type SettleUpHubProps = {
  groups: readonly { id: string; name: string; currency: string; icon?: string; color?: string }[];
  selectedGroupId?: string;
  onSelectGroup: (id: string) => void;
  accounts: readonly { id: string; name: string }[];
  selectedAccountId?: string;
  onSelectAccount: (id: string) => void;
  status: 'loading' | 'ready' | 'unavailable' | 'no-group';
  statusMessage?: string;
  onRetry?: () => void;
  meId: string | null;
  currency: string;
  balances: BalanceMap;
  people: readonly SettlePerson[];
  initialMemberId?: string;
  blockedReason?: string;
  saving: boolean;
  error?: string;
  onRecord: (transfers: SettleTransfer[], note?: string) => void;
  success?: { title: string; description: string } | null;
  onDone: () => void;
  onAnother: () => void;
  onBack: () => void;
};

export function SettleUpHub(p: SettleUpHubProps) {
  const plan = p.meId ? settleUpPlan(p.balances, p.meId) : null;
  const [chosenMemberId, setChosenMemberId] = React.useState<string | undefined>(p.initialMemberId);
  React.useEffect(() => setChosenMemberId(p.initialMemberId), [p.initialMemberId]);
  const selected =
    plan?.counterparts.find((item) => item.userId === chosenMemberId) ??
    (plan?.counterparts.length === 1 ? plan.counterparts[0] : undefined);
  const nameOf = (id: string) =>
    p.people.find((person) => person.id === id)?.name ?? `Member ${id.slice(-6)}`;
  const selectedGroup = p.groups.find((group) => group.id === p.selectedGroupId);
  const allMine = p.meId ? settleAllMine(p.balances, p.meId) : [];
  const blocked = !!p.blockedReason || p.saving;
  return (
    <main className={`${styles.page} ${styles.narrow}`}>
      <header className={styles.heading}>
        <button type="button" className={styles.back} aria-label="Go back" onClick={p.onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1>Settle up</h1>
      </header>
      {p.success ? (
        <SettleSuccess
          title={p.success.title}
          description={p.success.description}
          onDone={p.onDone}
          onAnother={p.onAnother}
        />
      ) : (
        <>
          {p.groups.length > 1 && (
            <div className={styles.chips} role="radiogroup" aria-label="Group">
              {p.groups.map((group) => {
                const active = group.id === p.selectedGroupId;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={styles.chip}
                    data-active={active || undefined}
                    onClick={() => {
                      setChosenMemberId(undefined);
                      p.onSelectGroup(group.id);
                    }}
                  >
                    <Tile icon={group.icon} color={group.color} />
                    {group.name}
                  </button>
                );
              })}
            </div>
          )}
          {p.status === 'no-group' ? (
            <IllustratedState
              scene="group"
              title={p.groups.length ? 'Pick a group' : 'No groups yet'}
              description={
                p.statusMessage ??
                (p.groups.length
                  ? 'Choose the group you want to settle up in.'
                  : 'Create or join a group to split and settle expenses.')
              }
            />
          ) : p.status === 'loading' ? (
            <SettleCard>
              <ListSkeleton rows={3} />
            </SettleCard>
          ) : p.status === 'unavailable' || !plan ? (
            <IllustratedState
              scene="offline"
              title="Balances unavailable"
              description={
                p.statusMessage ??
                'The full group ledger could not be loaded, so no partial balance is shown.'
              }
              action={
                p.onRetry ? (
                  <Button variant="outline" onPress={p.onRetry}>
                    Retry
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <NetPositionHero
                balanceMinor={plan.myBalanceMinor}
                currency={p.currency}
                title={selectedGroup?.name}
                people={p.people.filter((person) => !person.leftAt)}
              >
                {allMine.length > 0 && (
                  <Button disabled={blocked} onPress={() => p.onRecord(allMine)}>
                    {plan.direction === 'pay'
                      ? `Settle all mine · ${formatMinor(plan.totalSuggestedMinor, p.currency)}`
                      : `Mark all received · ${formatMinor(plan.totalSuggestedMinor, p.currency)}`}
                  </Button>
                )}
              </NetPositionHero>
              {plan.direction === 'settled' ? (
                <IllustratedState
                  scene="allSettled"
                  title="You’re all square"
                  description={
                    plan.transfers.length
                      ? 'You have nothing to settle. Others in the group still have open balances.'
                      : 'Everyone in this group is settled up.'
                  }
                />
              ) : (
                <SettleCard tone={plan.direction === 'pay' ? 'expense' : 'income'}>
                  <SectionTitle
                    level={3}
                    title={plan.direction === 'pay' ? 'You owe' : 'Owed to you'}
                    caption="Pick a person to record a full or partial payment."
                  />
                  <div className={styles.timeline} role="radiogroup" aria-label="Person">
                    {plan.counterparts.map((item) => {
                      const active = selected?.userId === item.userId;
                      const person = p.people.find((entry) => entry.id === item.userId);
                      const tone = item.direction === 'pay' ? 'expense' : 'income';
                      return (
                        <button
                          key={item.userId}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={styles.choice}
                          data-active={active || undefined}
                          data-tone={tone}
                          onClick={() => setChosenMemberId(item.userId)}
                        >
                          <PersonAvatar
                            name={nameOf(item.userId)}
                            url={person?.avatarUrl}
                            avatarId={person?.avatarId}
                            size={40}
                          />
                          <span className={styles.choiceCopy}>
                            <strong>{nameOf(item.userId)}</strong>
                            <small>
                              {item.suggestedMinor > 0n
                                ? `Suggested ${formatMinor(item.suggestedMinor, p.currency)}`
                                : `Up to ${formatMinor(item.maxAmountMinor, p.currency)}`}
                            </small>
                          </span>
                          <span className={styles.amount} data-tone={tone}>
                            {formatMinor(item.maxAmountMinor, p.currency)}
                          </span>
                          {active ? <Check size={18} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </SettleCard>
              )}
              {plan.transfers.length > 0 && (
                <SettleCard>
                  <SectionTitle
                    level={3}
                    title="Suggested transfers"
                    caption="The fewest payments that settle the whole group."
                  />
                  <SuggestedTransfers
                    transfers={plan.transfers}
                    currency={p.currency}
                    people={p.people}
                    meId={p.meId}
                    busy={blocked}
                    onSettle={(transfer) => p.onRecord([transfer])}
                  />
                </SettleCard>
              )}
              {plan.direction !== 'settled' && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>Record in account · {p.currency}</strong>
                  <div className={styles.chips} role="radiogroup" aria-label="Account">
                    {p.accounts.map((account) => {
                      const active = account.id === p.selectedAccountId;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={styles.chip}
                          data-account
                          data-active={active || undefined}
                          onClick={() => p.onSelectAccount(account.id)}
                        >
                          <IconTile tone={active ? 'accent' : 'neutral'} size={28}>
                            <Wallet size={15} />
                          </IconTile>
                          {account.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className={styles.muted}>
                    For your records only. No money moves from this account.
                  </p>
                </div>
              )}
              {selected && p.meId && (
                <SettleCard>
                  <SettlementEditor
                    key={`${p.selectedGroupId ?? ''}:${selected.userId}`}
                    memberName={nameOf(selected.userId)}
                    currency={p.currency}
                    direction={selected.direction}
                    maxAmountMinor={selected.maxAmountMinor}
                    suggestedMinor={selected.suggestedMinor}
                    disabledReason={p.blockedReason}
                    saving={p.saving}
                    error={p.error}
                    onSave={(amountMinor, note) =>
                      p.onRecord(
                        [transferWith(p.meId!, selected.userId, selected.direction, amountMinor)],
                        note,
                      )
                    }
                  />
                </SettleCard>
              )}
              {!selected && (p.blockedReason || p.error) && (
                <p
                  className={styles.notice}
                  data-tone={p.error ? 'error' : undefined}
                  role={p.error ? 'alert' : 'status'}
                >
                  {p.error ?? p.blockedReason}
                </p>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
