import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, IconTile, Sheet, StatusPill, Typography, useTheme } from '@finapp/ui/native';
import { Illustration } from '@finapp/ui/illustrations';
import { formatMinor } from '@convex/shared/money';
import { withAlpha } from '../../tokens';
import type { ExpenseImpact } from '../expenseImpact';
import { EntityIcon } from './EntityIconPicker';
import { GroupAvatar } from './GroupPrimitives';

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
 * Shows what an edit or delete does to every balance before it is saved, with a warning for
 * people who already settled up (their payment stays; a lowered share becomes a credit).
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
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Illustration scene="settleUp" size={150} />
          <Typography variant="heading">How balances change</Typography>
          <Typography variant="small" style={{ textAlign: 'center' }}>
            Balances are recalculated. Payments already recorded stay as they are.
          </Typography>
        </View>
        {impact?.status === 'ready' ? (
          <>
            {impact.settled.map((item) => (
              <View
                key={`settled-${item.userId}`}
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withAlpha(tokens.warning, 0.4),
                  backgroundColor: withAlpha(tokens.warning, 0.1),
                }}
              >
                <IconTile tone="warning" size={38}>
                  <EntityIcon value="phosphor:Handshake" size={20} color={tokens.warning} />
                </IconTile>
                <View style={{ flex: 1, gap: 4 }}>
                  <Typography variant="label">{nameOf(item.userId)} already settled up</Typography>
                  <Typography variant="small">
                    {item.credit
                      ? `They'll be owed ${money(item.after, currency)} back.`
                      : item.after < 0n
                        ? `They'll owe ${money(-item.after, currency)} again.`
                        : `Their balance moves to ${balanceLabel(item.after, currency).toLowerCase()}.`}
                  </Typography>
                </View>
              </View>
            ))}
            {impact.changes.map((change) => {
              const member = person(change.userId);
              const up = change.delta > 0n;
              return (
                <View
                  key={change.userId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderColor: tokens.borderSubtle,
                  }}
                >
                  <GroupAvatar
                    name={member?.name ?? 'Former member'}
                    avatarId={member?.avatarId}
                    avatarUrl={member?.avatarUrl}
                    size={36}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Typography variant="label">{member?.name ?? 'Former member'}</Typography>
                    <Typography variant="caption">
                      {balanceLabel(change.before, currency)} →{' '}
                      {balanceLabel(change.after, currency)}
                    </Typography>
                  </View>
                  <StatusPill
                    label={`${up ? '+' : '−'}${money(up ? change.delta : -change.delta, currency)}`}
                    tone={up ? 'income' : 'expense'}
                  />
                </View>
              );
            })}
            {!impact.changes.length && (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Illustration scene="allSettled" size={120} backdrop={false} />
                <Typography variant="small">No one's balance changes.</Typography>
              </View>
            )}
          </>
        ) : (
          <Typography variant="small">
            This device can't preview balances right now. Totals are recalculated when the change
            reaches the group.
          </Typography>
        )}
        <Button disabled={saving} onPress={onConfirm}>
          {saving ? 'Saving…' : confirmLabel}
        </Button>
        <Button variant="outline" disabled={saving} onPress={onClose}>
          Keep editing
        </Button>
      </ScrollView>
    </Sheet>
  );
}
