'use client';
import React from 'react';
import { Button, Empty } from '@finapp/ui/web';
import { Plus, PencilSimple, ChatCircle, Crown } from '@phosphor-icons/react';
import { formatMinor } from '@convex/shared/money';
import type { GroupChatScreenProps } from './GroupChatScreen';
import { GroupPage, Crumb, Tile, Metric, PersonAvatar, s } from './GroupUI';
export type GroupDetailMember = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  role?: string;
};
export type GroupDetailActivity = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
  category?: string;
  account?: string;
  icon?: string;
  color?: string;
};
export type GroupDetailSettlement = {
  id: string;
  description: string;
  amount: string;
  date?: string;
};
export type GroupDetailOption = { id: string; name: string };
export type GroupDetailScreenProps = {
  group: { name: string; currency: string; icon?: string; color?: string };
  groupOptions?: readonly GroupDetailOption[];
  currentGroupId?: string;
  onSelectGroup?: (id: string) => void;
  canSettle: boolean;
  balanceStatus: 'loading' | 'unavailable' | 'ready';
  balance: string;
  balanceMeaning: string;
  balanceError?: string;
  members: readonly GroupDetailMember[];
  activities: readonly GroupDetailActivity[];
  settlements: readonly GroupDetailSettlement[];
  chat: GroupChatScreenProps;
  totalSpend?: string;
  owed?: string;
  owing?: string;
  memberBalances?: readonly { id: string; name: string; amount: string; meaning: string }[];
  onBack: () => void;
  onOpenChat: () => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  onOpenBalances: () => void;
  onSettle: () => void;
  onAddExpense: () => void;
  onOpenPerson: (username: string) => void;
  onOpenActivity: (id: string) => void;
};
const colors = ['#68e789', '#f4cd63', '#70b9f5', '#ac8bf5', '#fa94b9'];
export function GroupDetailScreen(p: GroupDetailScreenProps) {
  const ready = p.balanceStatus === 'ready' && !p.balanceError;
  const unavailable = p.balanceStatus === 'loading' ? 'Loading…' : 'Unavailable';
  const categoryTotals = new Map<string, bigint>();
  const currencyTotals = new Map<string, bigint>();
  for (const activity of p.activities) {
    const category = activity.category ?? 'Shared expenses';
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0n) + activity.amountMinor);
    currencyTotals.set(
      activity.currency,
      (currencyTotals.get(activity.currency) ?? 0n) + activity.amountMinor,
    );
  }
  const categories = [...categoryTotals.entries()];
  const shownTotal = categories.reduce((sum, [, amount]) => sum + amount, 0n);
  let angle = 0;
  const stops = categories.map(([category, amount], index) => {
    const start = angle;
    angle += shownTotal > 0n ? Number((amount * 10000n) / shownTotal) / 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${angle}%`;
  });
  return (
    <GroupPage>
      <Crumb onBack={p.onBack} current={p.group.name} />
      {p.groupOptions && p.onSelectGroup && p.groupOptions.length > 0 && (
        <label className={s.muted} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Switch group{' '}
          <select
            aria-label="Switch group"
            value={p.currentGroupId ?? ''}
            onChange={(event) => p.onSelectGroup?.(event.target.value)}
            style={{
              color: 'inherit',
              background: 'var(--surface, transparent)',
              border: '1px solid currentColor',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {p.groupOptions.map((option, index) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {p.groupOptions!.filter((item) => item.name === option.name).length > 1
                  ? ` (${index + 1})`
                  : ''}
                {option.id === p.currentGroupId ? ' — current group' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <header className={s.hero}>
        <Tile large icon={p.group.icon} color={p.group.color} />
        <div className={s.heroCopy}>
          <h1>{p.group.name}</h1>
          <p className={s.subtitle}>Shared expenses with your group</p>
          <p className={s.muted}>
            {p.group.currency} · {p.members.length} members
          </p>
        </div>
        <span className={s.avatars}>
          {p.members.slice(0, 6).map((member) => (
            <PersonAvatar key={member.id} name={member.name} url={member.avatarUrl} size={38} />
          ))}
        </span>
        <div className={s.actions}>
          <Button variant="outline" onPress={p.onOpenSettings}>
            <PencilSimple size={17} /> Edit group
          </Button>
          <Button variant="outline" onPress={p.onOpenChat}>
            <ChatCircle size={17} /> Open chat
          </Button>
          <Button onPress={p.onAddExpense}>
            <Plus size={17} /> Add expense
          </Button>
        </div>
      </header>
      <section className={`${s.metrics} ${s.five}`}>
        <Metric
          label="Total group spend"
          value={ready && p.totalSpend ? p.totalSpend : unavailable}
          note="Complete ledger required"
          icon="phosphor:Wallet"
          color="#65d989"
        />
        <Metric
          label="You are owed"
          value={ready && p.owed ? p.owed : unavailable}
          note="Net group balance"
          icon="phosphor:ArrowUpRight"
          color="#65d989"
        />
        <Metric
          label="You owe"
          value={ready && p.owing ? p.owing : unavailable}
          note="Net group balance"
          icon="phosphor:ArrowUpRight"
          color="#ed7077"
        />
        <Metric
          label="Recorded settlements"
          value={String(p.settlements.length)}
          note="Recent saved payments"
          icon="phosphor:Receipt"
          color="#f4cd63"
        />
        <Metric
          label="Members"
          value={String(p.members.length)}
          note="Saved memberships"
          icon="phosphor:UsersThree"
          color="#ac8bf5"
        />
      </section>
      {p.balanceError && (
        <p className={s.error} role="alert">
          Complete balances are unavailable. No partial value is shown. {p.balanceError}
        </p>
      )}
      <div className={s.columns}>
        <div className={s.stack}>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Members ({p.members.length})</h3>
              <Button variant="ghost" size="sm" onPress={p.onOpenSettings}>
                Manage members →
              </Button>
            </div>
            <div className={s.members}>
              {p.members.map((member) => (
                <div key={member.id} className={s.member}>
                  <PersonAvatar name={member.name} url={member.avatarUrl} size={42} />
                  <div className={s.memberCopy}>
                    {member.username ? (
                      <button
                        className={s.chip}
                        type="button"
                        onClick={() => p.onOpenPerson(member.username!)}
                      >
                        {member.name}
                      </button>
                    ) : (
                      <strong>{member.name}</strong>
                    )}
                    <span
                      className={`${s.badge} ${member.role === 'admin' || member.role === 'owner' ? s.admin : ''}`}
                    >
                      {member.role ?? 'Member'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!p.members.length && <p className={s.muted}>Membership is not cached yet.</p>}
          </section>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Recent group expenses</h3>
              <Button variant="ghost" size="sm" onPress={p.onOpenAnalytics}>
                Group analytics →
              </Button>
            </div>
            {p.activities.length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Account</th>
                      <th>Date</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.activities.map((activity, index) => (
                      <tr
                        key={activity.id}
                        className={s.clickRow}
                        onClick={() => p.onOpenActivity(activity.id)}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              p.onOpenActivity(activity.id);
                            }}
                            className={s.member}
                          >
                            <Tile
                              icon={activity.icon ?? 'phosphor:Receipt'}
                              color={activity.color ?? '#f4cd63'}
                            />
                            <strong>{activity.title}</strong>
                          </button>
                        </td>
                        <td>
                          <span className={s.badge}>{activity.category ?? 'Shared expense'}</span>
                        </td>
                        <td>{activity.account ?? 'Not available'}</td>
                        <td>{activity.date}</td>
                        <td>
                          <strong>{formatMinor(activity.amountMinor, activity.currency)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No shared expenses"
                description="Add an expense to start your group history."
                action={
                  <Button variant="outline" onPress={p.onAddExpense}>
                    Add expense
                  </Button>
                }
              />
            )}
          </section>
          <section className={s.panel}>
            <h3>Recent settlements</h3>
            {p.settlements.map((settlement) => (
              <div className={s.activity} key={settlement.id}>
                <Tile icon="phosphor:ArrowsLeftRight" color="#65d989" />
                <div className={s.activityCopy}>
                  <strong>{settlement.description}</strong>
                  <small>{settlement.date}</small>
                </div>
                <strong>{settlement.amount}</strong>
              </div>
            ))}
            {!p.settlements.length && (
              <p className={s.muted}>No recorded settlements in the loaded history.</p>
            )}
          </section>
        </div>
        <aside className={s.stack}>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Balances &amp; settlements</h3>
              <Button size="sm" variant="ghost" onPress={p.onOpenBalances}>
                View all →
              </Button>
            </div>
            {ready ? (
              <>
                <div className={s.summaryAmount}>
                  <span>{p.balanceMeaning}</span>
                  <strong>{p.balance}</strong>
                </div>
                {p.memberBalances?.map((member) => (
                  <div key={member.id} className={s.activity}>
                    <PersonAvatar
                      name={member.name}
                      url={p.members.find((person) => person.id === member.id)?.avatarUrl}
                      size={30}
                    />
                    <div className={s.activityCopy}>
                      <strong>{member.name}</strong>
                      <small>{member.meaning}</small>
                    </div>
                    <strong>{member.amount}</strong>
                  </div>
                ))}
                {p.canSettle && (
                  <Button size="sm" onPress={p.onSettle}>
                    Record a settlement
                  </Button>
                )}
              </>
            ) : (
              <p className={s.muted}>
                {p.balanceStatus === 'loading'
                  ? 'Loading all-time balances…'
                  : 'Complete balances are unavailable. No partial value is shown.'}
              </p>
            )}
          </section>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Split insights</h3>
              <span className={s.badge}>Loaded expenses</span>
            </div>
            {shownTotal > 0n ? (
              <div className={s.donutLayout}>
                <div
                  className={s.donut}
                  style={{ background: `conic-gradient(${stops.join(',')})` }}
                >
                  <span>
                    {formatMinor(shownTotal, p.group.currency)}
                    <br />
                    <small className={s.muted}>Shown spend</small>
                  </span>
                </div>
                <div className={s.legend}>
                  {categories.map(([name, amount], index) => (
                    <div key={name} className={s.legendRow}>
                      <span
                        className={s.dot}
                        style={{ background: colors[index % colors.length] }}
                      />
                      <span>{name}</span>
                      <strong>{formatMinor(amount, p.group.currency)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={s.muted}>Add expenses to see a category breakdown.</p>
            )}
            <p className={s.muted}>
              This chart describes the expenses shown, not a partial all-time total.
            </p>
          </section>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Recent messages</h3>
              <Button variant="ghost" size="sm" onPress={p.onOpenChat}>
                View all →
              </Button>
            </div>
            {p.chat.items
              .filter((item) => item.kind === 'message')
              .slice(-4)
              .map((item) => (
                <div className={s.activity} key={item.id}>
                  <PersonAvatar
                    name={item.ownMessage ? 'You' : (item.sender ?? 'Member')}
                    url={item.senderAvatarUrl}
                    size={28}
                  />
                  <div className={s.activityCopy}>
                    <strong>{item.sender ?? 'You'}</strong>
                    <small>
                      {item.text ??
                        (item.attachmentUrl
                          ? 'Shared a bill image'
                          : 'Bill image no longer available')}
                    </small>
                  </div>
                  <small className={s.muted}>{item.date}</small>
                </div>
              ))}
            {!p.chat.items.some((item) => item.kind === 'message') && (
              <p className={s.muted}>
                {p.chat.loading
                  ? 'Loading saved messages…'
                  : p.chat.canSend
                    ? 'No messages yet. Start the conversation.'
                    : 'Connect and sync the group to load messages.'}
              </p>
            )}
            <Button size="sm" variant="outline" onPress={p.onOpenChat}>
              Open group chat
            </Button>
          </section>
        </aside>
      </div>
    </GroupPage>
  );
}
