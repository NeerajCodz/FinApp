'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Plus, Search, UsersRound } from 'lucide-react';
import { Button, Card, Empty, Input, SectionHeader } from '@finapp/ui/web';
import { GroupCard } from './GroupCard';
import { PeopleRail } from './PeopleRail';
export type GroupOverviewItem = {
  id: string;
  name: string;
  currency: string;
  icon?: string;
  color?: string;
  memberCount: number;
  balance: string;
  balanceMeaning: string;
};
export type GroupOverviewSummary = { currency: string; owed: string; owing: string };
export type GroupOverviewActivity = {
  id: string;
  title: string;
  groupName: string;
  kind: 'expense' | 'settlement';
  amount: string;
  date: string;
};
export type GroupsOverviewScreenProps = {
  groups: readonly GroupOverviewItem[];
  summaries: readonly GroupOverviewSummary[];
  activities: readonly GroupOverviewActivity[];
  balancesLoading: boolean;
  loading: boolean;
  error?: string;
  phoneVerified: boolean;
  onCreate: () => void;
  onInvite: () => void;
  onOpenGroup: (id: string) => void;
  onOpenChat: (id: string) => void;
  signedIn: boolean;
  onSignIn: () => void;
};
export function GroupsOverviewScreen({
  groups,
  summaries,
  activities,
  balancesLoading,
  loading,
  error,
  phoneVerified,
  onCreate,
  onInvite,
  onOpenGroup,
  onOpenChat,
  signedIn,
  onSignIn,
}: GroupsOverviewScreenProps) {
  const [query, setQuery] = useState('');
  const filteredGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return groups.filter((group) => !search || group.name.toLocaleLowerCase().includes(search));
  }, [groups, query]);
  if (!signedIn)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SHARED FINANCES</p>
        <h1>Make room for the group.</h1>
        <p>Sign in to view groups saved in this browser or create a new shared space.</p>
        <Button onPress={onSignIn}>
          Sign in <ArrowRight size={16} />
        </Button>
      </section>
    );

  return (
    <main className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">SHARED FINANCES</p>
          <h1>Groups</h1>
          <p className="finance-muted">
            Share expenses, settle up, and keep the conversation going.
          </p>
        </div>
        <Button onPress={onCreate}>
          <Plus size={17} /> New group
        </Button>
      </header>
      <section aria-label="Group overview" style={{ display: 'grid', gap: 6 }}>
        <strong>Shared ledgers</strong>
        <p className="finance-muted" aria-live="polite">
          {loading
            ? 'Loading your groups…'
            : error
              ? 'Your groups are temporarily unavailable.'
              : `${groups.length} active ${groups.length === 1 ? 'group' : 'groups'} saved on this device`}
        </p>
      </section>
      <PeopleRail title="People to split with" phoneVerified={phoneVerified} onChoose={onInvite} />
      <Card className="finance-record-panel" aria-label="Balances across groups">
        <SectionHeader title="Your balances" />
        {summaries.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 10,
            }}
          >
            {summaries.map((summary) => (
              <div
                key={summary.currency}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  padding: 14,
                  border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                  borderRadius: 14,
                }}
              >
                <div>
                  <span className="finance-muted">Owed to you · {summary.currency}</span>
                  <strong style={{ display: 'block' }}>{summary.owed}</strong>
                </div>
                <div>
                  <span className="finance-muted">You owe · {summary.currency}</span>
                  <strong style={{ display: 'block' }}>{summary.owing}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : balancesLoading ? (
          <p className="finance-muted" role="status">
            Loading complete group balances…
          </p>
        ) : groups.length === 0 ? (
          <p className="finance-muted">Create a group to see shared balances.</p>
        ) : (
          <p className="finance-muted">
            Complete balances are unavailable until each group’s full history is loaded.
          </p>
        )}
      </Card>
      {error && (
        <p className="finance-form-error" role="alert">
          Saved groups could not be read: {error}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Your groups"
          action={
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} aria-hidden="true" />
              <Input
                aria-label="Search groups"
                placeholder="Search groups"
                value={query}
                onChangeText={setQuery}
              />
            </label>
          }
        />
        {loading ? (
          <p className="finance-muted" role="status">
            Loading groups…
          </p>
        ) : error ? (
          <Empty
            title="Groups unavailable"
            description="Your saved groups could not be loaded."
            icon={<UsersRound size={20} />}
          />
        ) : filteredGroups.length === 0 ? (
          <Empty
            title={query ? 'No matching groups' : 'No groups yet'}
            description={
              query
                ? 'Try another group name.'
                : 'Create a group for expenses you share with people.'
            }
            icon={<UsersRound size={20} />}
            action={
              !query ? (
                <Button onPress={onCreate}>
                  Create group <ArrowRight size={15} />
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="finance-record-list">
            {filteredGroups.map((group) => (
              <li key={group.id}>
                <GroupCard
                  name={group.name}
                  icon={group.icon}
                  color={group.color}
                  meta={`${group.currency}${group.currency ? ' · ' : ''}${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`}
                  balance={group.balance}
                  meaning={group.balanceMeaning}
                  onPress={() => onOpenGroup(group.id)}
                  onOpenChat={() => onOpenChat(group.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader title="Recent group activity" />
        {activities.length ? (
          <ul className="finance-record-list">
            {activities.map((activity) => (
              <li
                key={activity.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--finance-border, rgba(127,127,127,.12))',
                }}
              >
                <div>
                  <strong>{activity.title}</strong>
                  <div className="finance-muted">
                    {activity.groupName} ·{' '}
                    {activity.kind === 'expense' ? 'Expense' : 'Recorded settlement'} ·{' '}
                    {activity.date}
                  </div>
                </div>
                <strong>{activity.amount}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="finance-muted">
            {balancesLoading
              ? 'Loading recent activity…'
              : 'No recent group activity is available from the loaded ledgers.'}
          </p>
        )}
      </Card>
    </main>
  );
}
