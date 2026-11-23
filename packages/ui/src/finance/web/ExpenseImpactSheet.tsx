'use client';
import React from 'react';
import { Button, IconTile, Sheet, StatusPill, useTheme } from '@finapp/ui/web';
import { Illustration } from '@finapp/ui/illustrations';
import { formatMinor } from '@convex/shared/money';
import type { ExpenseImpact } from '../expenseImpact';
import { EntityIcon } from './EntityIconPicker';
import { PersonAvatar } from './GroupUI';
import f from './SplitFlow.module.css';

export type ImpactPerson = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
};

function money(value: bigint, currency: string) {
  try {
    return formatMinor(value, currency);
  } catch {
    return value.toString();
  }
}

/** Plain-language balance: "Owed ₹200", "Owes ₹150", "Settled up". */
export function balanceLabel(value: bigint, currency: string): string {
  return value > 0n
    ? `Owed ${money(value, currency)}`
    : value < 0n
      ? `Owes ${money(-value, currency)}`
      : 'Settled up';
}

/**
 * Shows what an edit does to every balance before it is saved, with a warning for people who
 * already settled up (their payment stays; a lowered share becomes a credit).
 */
export function ExpenseImpactSheet({
  visible,
  onClose,
  onConfirm,
  impact,
  people,
  currency,
  saving,
  confirmLabel = 'Save changes',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  impact: ExpenseImpact | null;
  people: readonly ImpactPerson[];
  currency: string;
  saving?: boolean;
  confirmLabel?: string;
}) {
  const { tokens } = useTheme();
  const person = (id: string) => people.find((item) => item.userId === id);
  const nameOf = (id: string) => person(id)?.name ?? 'Former member';
  return (
    <Sheet visible={visible} onClose={onClose} title="Before you save">
      <div className={f.stack}>
        <div className={f.center}>
          <Illustration scene="settleUp" size={170} />
          <strong>How balances change</strong>
          <p className={f.muted}>
            Balances are recalculated. Payments already recorded stay as they are.
          </p>
        </div>
        {impact?.status === 'ready' ? (
          <>
            {impact.settled.map((item) => (
              <div
                key={`settled-${item.userId}`}
                className={f.notice}
                data-tone="warning"
                role="alert"
              >
                <IconTile tone="warning" size={36}>
                  <EntityIcon value="phosphor:Handshake" size={20} color={tokens.warning} />
                </IconTile>
                <span>
                  <strong>{nameOf(item.userId)} already settled up. </strong>
                  {item.credit
                    ? `They'll be owed ${money(item.after, currency)} back.`
                    : item.after < 0n
                      ? `They'll owe ${money(-item.after, currency)} again.`
                      : `Their balance moves to ${balanceLabel(item.after, currency).toLowerCase()}.`}
                </span>
              </div>
            ))}
            <div className={f.rows}>
              {impact.changes.map((change) => {
                const member = person(change.userId);
                const up = change.delta > 0n;
                return (
                  <div className={f.row} key={change.userId}>
                    <PersonAvatar
                      name={member?.name ?? 'Former member'}
                      url={member?.avatarUrl}
                      avatarId={member?.avatarId}
                      size={34}
                    />
                    <span className={f.rowCopy}>
                      <strong>{member?.name ?? 'Former member'}</strong>
                      <small className={f.muted}>
                        {balanceLabel(change.before, currency)} →{' '}
                        {balanceLabel(change.after, currency)}
                      </small>
                    </span>
                    <StatusPill
                      label={`${up ? '+' : '−'}${money(up ? change.delta : -change.delta, currency)}`}
                      tone={up ? 'income' : 'expense'}
                    />
                  </div>
                );
              })}
            </div>
            {!impact.changes.length && (
              <div className={f.center}>
                <Illustration scene="allSettled" size={130} backdrop={false} />
                <p className={f.muted}>No one&apos;s balance changes.</p>
              </div>
            )}
          </>
        ) : (
          <p className={f.muted}>
            This browser can&apos;t preview balances right now. Totals are recalculated when the
            change reaches the group.
          </p>
        )}
        <div className={f.actions}>
          <Button variant="outline" disabled={saving} onPress={onClose}>
            Keep editing
          </Button>
          <Button disabled={saving} onPress={onConfirm}>
            {saving ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
