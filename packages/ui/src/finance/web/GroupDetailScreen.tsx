'use client';

import React from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesCombined,
  Plus,
  Settings2,
} from 'lucide-react';
import { Avatar, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { TransactionRow } from './TransactionRow';
import { EntityIcon } from './EntityIconPicker';
import { GroupChatScreen, type GroupChatScreenProps } from './GroupChatScreen';

export type GroupDetailMember = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
};
export type GroupDetailActivity = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
};
export type GroupDetailSettlement = {
  id: string;
  description: string;
  amount: string;
  date?: string;
};
export type GroupDetailScreenProps = {
  group: { name: string; currency: string; icon?: string; color?: string };
  canSettle: boolean;
  balanceStatus: 'loading' | 'unavailable' | 'ready';
  balance: string;
  balanceMeaning: string;
  balanceError?: string;
  members: readonly GroupDetailMember[];
  activities: readonly GroupDetailActivity[];
  settlements: readonly GroupDetailSettlement[];
  chat: GroupChatScreenProps;
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

export function GroupDetailScreen({
  group,
  balanceStatus,
  canSettle,
  balance,
  balanceMeaning,
  balanceError,
  members,
  activities,
  settlements,
  chat,
  onBack,
  onOpenChat,
  onOpenAnalytics,
  onOpenSettings,
  onOpenBalances,
  onSettle,
  onAddExpense,
  onOpenPerson,
  onOpenActivity,
}: GroupDetailScreenProps) {
  return (
    <main className="finance-page">
      <header className="finance-page-heading">
        <Button size="icon" variant="ghost" aria-label="Go back to groups" onPress={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <EntityIcon value={group.icon ?? 'phosphor:UsersThree'} size={24} color={group.color} />
        <h1 style={{ flex: 1, margin: 0 }}>{group.name}</h1>
        <Button variant="outline" onPress={onOpenChat}>
          Open chat <ArrowRight size={15} />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Group analytics" onPress={onOpenAnalytics}>
          <ChartNoAxesCombined size={18} />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Edit group" onPress={onOpenSettings}>
          <Settings2 size={18} />
        </Button>
      </header>
      {balanceError && (
        <p className="finance-form-error" role="alert">
          Complete group balances are unavailable. No partial value is shown. {balanceError}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader title="Your balance" />
        <strong className="finance-record-amount">
          {balanceStatus === 'loading'
            ? 'Loading…'
            : balanceStatus === 'unavailable'
              ? 'Balance unavailable'
              : balance}
        </strong>
        <p className="finance-muted">
          {balanceStatus === 'loading'
            ? 'Loading all-time balance…'
            : balanceStatus === 'unavailable'
              ? 'Complete group balances are unavailable. No partial value is shown.'
              : balanceMeaning}
        </p>
        <div className="finance-page-actions">
          <Button variant="outline" onPress={onOpenBalances}>
            View member balances <ArrowRight size={15} />
          </Button>
          {balanceStatus === 'ready' && canSettle && (
            <Button variant="outline" onPress={onSettle}>
              Record a settlement <ArrowLeftRight size={15} />
            </Button>
          )}
        </div>
      </Card>
      <Button onPress={onAddExpense}>
        <Plus size={17} /> Add expense
      </Button>
      <GroupChatScreen {...chat} />
      <section style={{ display: 'grid', gap: 24 }}>
        <section>
          <SectionHeader title="People" />
          {members.length ? (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBlock: 12 }}>
              {members.map((member) => {
                const content = (
                  <>
                    <Avatar
                      initials={member.name
                        .split(/\s+/)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .slice(0, 2)}
                      label={member.name}
                      size={48}
                      imageUrl={member.avatarUrl ?? null}
                    />
                    <small>
                      {member.username ? `@${member.username.replace(/^@+/, '')}` : member.name}
                    </small>
                  </>
                );
                return member.username ? (
                  <button
                    key={member.id}
                    type="button"
                    aria-label={`Open @${member.username}`}
                    onClick={() => onOpenPerson(member.username!)}
                    style={{
                      display: 'grid',
                      width: 96,
                      flex: '0 0 96px',
                      justifyItems: 'center',
                      gap: 7,
                      color: 'inherit',
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <span
                    key={member.id}
                    style={{
                      display: 'grid',
                      width: 96,
                      flex: '0 0 96px',
                      justifyItems: 'center',
                      gap: 7,
                    }}
                  >
                    {content}
                  </span>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No members saved"
              description="Members invited to this group will appear here."
            />
          )}
        </section>
        <section>
          <SectionHeader title="Recent" />
          {activities.length ? (
            <div className="finance-record-list">
              {activities.map((activity) => (
                <TransactionRow
                  key={activity.id}
                  title={activity.title}
                  category="Group expense"
                  account={group.name}
                  amountMinor={activity.amountMinor}
                  currency={activity.currency}
                  type="expense"
                  semanticType="split"
                  date={activity.date}
                  onPress={() => onOpenActivity(activity.id)}
                />
              ))}
            </div>
          ) : (
            <Empty
              title="No shared expenses"
              description="Add an expense to start your group history."
              action={
                <Button variant="outline" onPress={onAddExpense}>
                  Add expense <ArrowRight size={15} />
                </Button>
              }
            />
          )}
        </section>
        <section>
          <SectionHeader title="Recent settlements" />
          {settlements.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {settlements.map((settlement) => (
                <Card
                  key={settlement.id}
                  className="finance-record-panel"
                  style={{ display: 'grid', gap: 8 }}
                >
                  <strong>{settlement.description}</strong>
                  <span className="finance-record-amount">{settlement.amount}</span>
                  {settlement.date && <time className="finance-muted">{settlement.date}</time>}
                </Card>
              ))}
            </div>
          ) : (
            <p className="finance-muted">Settlements recorded for this group will appear here.</p>
          )}
        </section>
      </section>
    </main>
  );
}
