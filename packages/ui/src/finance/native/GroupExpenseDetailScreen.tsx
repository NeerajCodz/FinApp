import React from 'react';
import { ScrollView, View } from 'react-native';
import {
  AlertDialog,
  AvatarStack,
  Button,
  FadeIn,
  HeroCard,
  IconTile,
  ListSkeleton,
  StatusPill,
  toneColor,
  Typography,
  useTheme,
  type VisualTone,
} from '@finapp/ui/native';
import { Illustration } from '@finapp/ui/illustrations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import type { ShareStatus } from '../expenseImpact';
import { EntityIcon } from './EntityIconPicker';
import { GroupHeading, GroupPanel } from './GroupPrimitives';
import { MemberShareRow } from './SplitVisuals';
import { LineItemsReceipt } from './LineItems';
import { itemizedBreakdown, type LineItemView } from '../lineItems';

export type ExpensePerson = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
  amountMinor: bigint;
};
export type ExpenseShareView = ExpensePerson & {
  status: ShareStatus | null;
  /** Current group balance of this person (positive: owed to them). */
  balanceMinor?: bigint;
};
export type ExpenseHistoryEvent = {
  id: string;
  kind: string;
  actorName: string;
  summary: string;
  createdAt: number;
  changes: readonly { name: string; amountMinor: bigint }[];
};
export type ExpenseHistoryState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ready'; events: readonly ExpenseHistoryEvent[] };

export type GroupExpenseDetailScreenProps = {
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
  groupName?: string;
  category?: string;
  merchant?: string;
  note?: string;
  payers: readonly ExpensePerson[];
  shares: readonly ExpenseShareView[];
  history: ExpenseHistoryState;
  canManage: boolean;
  /** Why editing is unavailable to this viewer, shown instead of the actions. */
  manageHint?: string;
  pendingSync?: boolean;
  deleting?: boolean;
  /** One-line summary of what deleting does to balances, shown in the confirmation. */
  deleteImpact?: string;
  loading?: boolean;
  unavailable?: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onOpenGroup?: () => void;
  /** Line items on the expense. */
  items?: readonly LineItemView[];
  /** Split item by item: show who shared each item. */
  itemized?: boolean;
};

function money(value: bigint, currency: string) {
  try {
    return formatMinor(value, currency);
  } catch {
    return value.toString();
  }
}

const statusView: Record<ShareStatus, { label: string; tone: VisualTone }> = {
  paid: { label: 'Paid', tone: 'income' },
  settled: { label: 'Settled up', tone: 'settlement' },
  owes: { label: 'Owes', tone: 'expense' },
  owed: { label: 'Owed back', tone: 'income' },
};

const historyView: Record<string, { icon: string; tone: VisualTone; verb: string }> = {
  'expense.created': { icon: 'phosphor:PlusCircle', tone: 'income', verb: 'added this expense' },
  'expense.updated': { icon: 'phosphor:PencilSimple', tone: 'split', verb: 'edited it' },
  'expense.deleted': { icon: 'phosphor:Trash', tone: 'destructive', verb: 'deleted it' },
  'expense.membersAdded': { icon: 'phosphor:UserPlus', tone: 'accent', verb: 'added people' },
};

export function GroupExpenseDetailScreen(p: GroupExpenseDetailScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = React.useState(false);
  const people = [...p.payers, ...p.shares].filter(
    (person, index, all) => all.findIndex((item) => item.userId === person.userId) === index,
  );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 16,
      }}
    >
      <GroupHeading title="Shared expense" subtitle={p.groupName} onBack={p.onBack} />
      {p.loading ? (
        <ListSkeleton rows={4} />
      ) : p.unavailable ? (
        <GroupPanel>
          <Illustration scene="error" size={150} />
          <Typography accessibilityRole="alert">{p.unavailable}</Typography>
        </GroupPanel>
      ) : (
        <>
          <FadeIn>
            <HeroCard tone="split">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Typography variant="overline" style={{ color: tokens.split }}>
                    {p.category ?? 'Split expense'}
                  </Typography>
                  <Typography variant="title">{p.title}</Typography>
                  <Typography variant="display" style={{ fontVariant: ['tabular-nums'] }}>
                    {money(p.amountMinor, p.currency)}
                  </Typography>
                  <Typography variant="caption">
                    {p.date}
                    {p.merchant ? ` · ${p.merchant}` : ''}
                  </Typography>
                </View>
                <Illustration scene="splitBill" size={112} backdrop={false} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AvatarStack
                  people={people.map((person) => ({
                    id: person.userId,
                    name: person.name,
                    imageUrl: person.avatarUrl,
                    avatarId: person.avatarId,
                  }))}
                />
                <Typography variant="caption" style={{ flex: 1 }}>
                  Shared by {p.shares.length} {p.shares.length === 1 ? 'person' : 'people'}
                </Typography>
                {p.pendingSync && <StatusPill label="Waiting to sync" tone="warning" />}
              </View>
            </HeroCard>
          </FadeIn>

          <FadeIn index={1}>
            <GroupPanel>
              <SectionTitle icon="phosphor:HandCoins" tone="income" title="Who paid" />
              {p.payers.map((payer) => (
                <MemberShareRow
                  key={payer.userId}
                  name={payer.name}
                  avatarId={payer.avatarId}
                  avatarUrl={payer.avatarUrl}
                  detail="Paid"
                  amount={money(payer.amountMinor, p.currency)}
                />
              ))}
            </GroupPanel>
          </FadeIn>

          <FadeIn index={2}>
            <GroupPanel>
              <SectionTitle
                icon="phosphor:ChartPieSlice"
                tone="split"
                title="Each person's share"
              />
              {p.shares.map((share) => {
                const view = share.status ? statusView[share.status] : null;
                const balance = share.balanceMinor;
                return (
                  <MemberShareRow
                    key={share.userId}
                    name={share.name}
                    avatarId={share.avatarId}
                    avatarUrl={share.avatarUrl}
                    amount={money(share.amountMinor, p.currency)}
                    status={
                      view
                        ? {
                            label:
                              share.status === 'owes' && balance !== undefined
                                ? `Owes ${money(-balance, p.currency)} in group`
                                : share.status === 'owed' && balance !== undefined
                                  ? `Owed ${money(balance, p.currency)} in group`
                                  : view.label,
                            tone: view.tone,
                          }
                        : undefined
                    }
                  />
                );
              })}
              {p.note ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <EntityIcon value="phosphor:Note" size={18} color={tokens.foregroundMuted} />
                  <Typography variant="small" style={{ flex: 1 }}>
                    {p.note}
                  </Typography>
                </View>
              ) : null}
            </GroupPanel>
          </FadeIn>

          {!!p.items?.length && (
            <FadeIn index={2}>
              <LineItemsReceipt
                title={p.itemized ? 'Who had what' : 'Items'}
                currency={p.currency}
                items={
                  p.itemized
                    ? itemizedBreakdown(p.items, p.shares).items
                    : p.items.map((item) => ({ ...item, sharers: [] }))
                }
                people={p.itemized ? p.shares : undefined}
              />
            </FadeIn>
          )}

          {p.canManage ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button style={{ flex: 1 }} onPress={p.onEdit} disabled={p.deleting}>
                Edit
              </Button>
              <Button
                style={{ flex: 1 }}
                variant="destructive"
                disabled={p.deleting}
                onPress={() => setConfirming(true)}
              >
                {p.deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </View>
          ) : p.manageHint ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <EntityIcon value="phosphor:Lock" size={16} color={tokens.foregroundMuted} />
              <Typography variant="caption" style={{ flex: 1 }}>
                {p.manageHint}
              </Typography>
            </View>
          ) : null}

          <FadeIn index={3}>
            <GroupPanel>
              <SectionTitle icon="phosphor:ClockCounterClockwise" tone="accent" title="History" />
              <HistoryTimeline history={p.history} currency={p.currency} />
            </GroupPanel>
          </FadeIn>

          {!!p.onOpenGroup && (
            <Button variant="outline" onPress={p.onOpenGroup}>
              Open group
            </Button>
          )}
        </>
      )}
      <AlertDialog
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this expense?"
        description={
          p.deleteImpact ??
          'It is removed for everyone in the group and balances are recalculated. Recorded payments stay.'
        }
        confirmLabel="Delete expense"
        destructive
        onConfirm={p.onDelete}
      />
    </ScrollView>
  );
}

function SectionTitle({ icon, tone, title }: { icon: string; tone: VisualTone; title: string }) {
  const { tokens } = useTheme();
  const color = toneColor(tokens, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconTile tone={tone} size={34}>
        <EntityIcon value={icon} size={18} color={color} />
      </IconTile>
      <Typography variant="heading">{title}</Typography>
    </View>
  );
}

function HistoryTimeline({
  history,
  currency,
}: {
  history: ExpenseHistoryState;
  currency: string;
}) {
  const { tokens } = useTheme();
  if (history.status === 'loading') return <ListSkeleton rows={2} />;
  if (history.status === 'offline' || !history.events.length)
    return (
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Illustration scene={history.status === 'offline' ? 'offline' : 'history'} size={130} />
        <Typography variant="small" style={{ textAlign: 'center' }}>
          {history.status === 'offline'
            ? 'History appears when you are back online.'
            : 'No changes recorded yet.'}
        </Typography>
      </View>
    );
  return (
    <View>
      {history.events.map((event, index) => {
        const view = historyView[event.kind] ?? {
          icon: 'phosphor:Circle',
          tone: 'neutral' as const,
          verb: 'changed it',
        };
        const color = toneColor(tokens, view.tone);
        const last = index === history.events.length - 1;
        return (
          <View key={event.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <IconTile tone={view.tone} size={32}>
                <EntityIcon value={view.icon} size={16} color={color} />
              </IconTile>
              {!last && (
                <View style={{ width: 2, flex: 1, backgroundColor: tokens.borderSubtle }} />
              )}
            </View>
            <View style={{ flex: 1, gap: 4, paddingBottom: last ? 0 : 16 }}>
              <Typography variant="label">
                {event.actorName} {view.verb}
              </Typography>
              <Typography variant="caption">
                {new Date(event.createdAt).toLocaleString()} · {event.summary}
              </Typography>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {event.changes.map((change) => (
                  <StatusPill
                    key={change.name}
                    label={`${change.name} ${change.amountMinor > 0n ? '+' : '−'}${money(
                      change.amountMinor > 0n ? change.amountMinor : -change.amountMinor,
                      currency,
                    )}`}
                    tone={change.amountMinor > 0n ? 'income' : 'expense'}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
