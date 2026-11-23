'use client';
import React from 'react';
import {
  AlertDialog,
  AvatarStack,
  Button,
  HeroCard,
  IconTile,
  ListSkeleton,
  StatusPill,
  useTheme,
  type VisualTone,
} from '@finapp/ui/web';
import { Illustration } from '@finapp/ui/illustrations';
import { formatMinor } from '@convex/shared/money';
import type { ShareStatus } from '../expenseImpact';
import { EntityIcon } from './EntityIconPicker';
import { Crumb, GroupPage, PersonAvatar } from './GroupUI';
import f from './SplitFlow.module.css';
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
  manageHint?: string;
  pendingSync?: boolean;
  deleting?: boolean;
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

function useToneColor() {
  const { tokens } = useTheme();
  return (tone: VisualTone) =>
    tone === 'accent' ? tokens.primary : tone === 'neutral' ? tokens.foregroundMuted : tokens[tone];
}

export function GroupExpenseDetailScreen(p: GroupExpenseDetailScreenProps) {
  const { tokens } = useTheme();
  const [confirming, setConfirming] = React.useState(false);
  const people = [...p.payers, ...p.shares].filter(
    (person, index, all) => all.findIndex((item) => item.userId === person.userId) === index,
  );
  return (
    <GroupPage>
      <Crumb onBack={p.onBack} name={p.groupName} current="Shared expense" />
      {p.loading ? (
        <ListSkeleton rows={4} />
      ) : p.unavailable ? (
        <section className={`${f.panel} ${f.center}`}>
          <Illustration scene="error" size={180} />
          <p role="alert">{p.unavailable}</p>
          <Button variant="outline" onPress={p.onBack}>
            Back
          </Button>
        </section>
      ) : (
        <div className={f.layout}>
          <div className={f.stack}>
            <HeroCard tone="split">
              <div className={f.hero}>
                <div className={f.heroCopy}>
                  <span className={f.overline}>{p.category ?? 'Split expense'}</span>
                  <h1 style={{ margin: 0 }}>{p.title}</h1>
                  <p className={f.total}>{money(p.amountMinor, p.currency)}</p>
                  <p className={f.muted}>
                    {p.date}
                    {p.merchant ? ` · ${p.merchant}` : ''}
                  </p>
                </div>
                <Illustration scene="splitBill" size={150} backdrop={false} />
              </div>
              <div className={f.stepTitle}>
                <AvatarStack
                  people={people.map((person) => ({
                    id: person.userId,
                    name: person.name,
                    imageUrl: person.avatarUrl,
                    avatarId: person.avatarId,
                  }))}
                />
                <span className={f.muted} style={{ flex: 1 }}>
                  Shared by {p.shares.length} {p.shares.length === 1 ? 'person' : 'people'}
                </span>
                {p.pendingSync && <StatusPill label="Waiting to sync" tone="warning" />}
              </div>
            </HeroCard>

            <section className={f.panel}>
              <SectionTitle icon="phosphor:HandCoins" tone="income" title="Who paid" />
              <div className={f.rows}>
                {p.payers.map((payer) => (
                  <div className={f.row} key={payer.userId}>
                    <PersonAvatar
                      name={payer.name}
                      url={payer.avatarUrl}
                      avatarId={payer.avatarId}
                      size={36}
                    />
                    <span className={f.rowCopy}>
                      <strong>{payer.name}</strong>
                      <small className={f.muted}>Paid</small>
                    </span>
                    <span className={f.amount}>{money(payer.amountMinor, p.currency)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={f.panel}>
              <SectionTitle
                icon="phosphor:ChartPieSlice"
                tone="split"
                title="Each person's share"
              />
              <div className={f.rows}>
                {p.shares.map((share) => {
                  const view = share.status ? statusView[share.status] : null;
                  const balance = share.balanceMinor;
                  return (
                    <div className={f.row} key={share.userId}>
                      <PersonAvatar
                        name={share.name}
                        url={share.avatarUrl}
                        avatarId={share.avatarId}
                        size={36}
                      />
                      <span className={f.rowCopy}>
                        <strong>{share.name}</strong>
                        {view && (
                          <StatusPill
                            label={
                              share.status === 'owes' && balance !== undefined
                                ? `Owes ${money(-balance, p.currency)} in group`
                                : share.status === 'owed' && balance !== undefined
                                  ? `Owed ${money(balance, p.currency)} in group`
                                  : view.label
                            }
                            tone={view.tone}
                          />
                        )}
                      </span>
                      <span className={f.amount}>{money(share.amountMinor, p.currency)}</span>
                    </div>
                  );
                })}
              </div>
              {p.note && (
                <p className={f.notice} data-tone="warning">
                  <EntityIcon value="phosphor:Note" size={18} color={tokens.foregroundMuted} />
                  {p.note}
                </p>
              )}
            </section>
            {!!p.items?.length && (
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
            )}

            {p.canManage ? (
              <div className={f.actions}>
                <Button onPress={p.onEdit} disabled={p.deleting}>
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  disabled={p.deleting}
                  onPress={() => setConfirming(true)}
                >
                  {p.deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            ) : p.manageHint ? (
              <p className={f.muted}>
                <EntityIcon value="phosphor:Lock" size={14} color={tokens.foregroundMuted} />{' '}
                {p.manageHint}
              </p>
            ) : null}
          </div>
          <aside className={f.stack}>
            <section className={f.panel}>
              <SectionTitle icon="phosphor:ClockCounterClockwise" tone="accent" title="History" />
              <HistoryTimeline history={p.history} currency={p.currency} />
            </section>
            {p.onOpenGroup && (
              <Button variant="outline" onPress={p.onOpenGroup}>
                Open group
              </Button>
            )}
          </aside>
        </div>
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
    </GroupPage>
  );
}

function SectionTitle({ icon, tone, title }: { icon: string; tone: VisualTone; title: string }) {
  const color = useToneColor();
  return (
    <div className={f.stepTitle}>
      <IconTile tone={tone} size={34}>
        <EntityIcon value={icon} size={18} color={color(tone)} />
      </IconTile>
      <h2>{title}</h2>
    </div>
  );
}

function HistoryTimeline({
  history,
  currency,
}: {
  history: ExpenseHistoryState;
  currency: string;
}) {
  const color = useToneColor();
  if (history.status === 'loading') return <ListSkeleton rows={2} />;
  if (history.status === 'offline' || !history.events.length)
    return (
      <div className={f.center}>
        <Illustration scene={history.status === 'offline' ? 'offline' : 'history'} size={150} />
        <p className={f.muted}>
          {history.status === 'offline'
            ? 'History appears when you are back online.'
            : 'No changes recorded yet.'}
        </p>
      </div>
    );
  return (
    <ol className={f.timeline}>
      {history.events.map((event) => {
        const view = historyView[event.kind] ?? {
          icon: 'phosphor:Circle',
          tone: 'neutral' as const,
          verb: 'changed it',
        };
        return (
          <li className={f.event} key={event.id}>
            <span className={f.rail}>
              <IconTile tone={view.tone} size={32}>
                <EntityIcon value={view.icon} size={16} color={color(view.tone)} />
              </IconTile>
            </span>
            <div className={f.eventBody}>
              <strong>
                {event.actorName} {view.verb}
              </strong>
              <small className={f.muted}>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>{' '}
                · {event.summary}
              </small>
              <div className={f.pills}>
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
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
