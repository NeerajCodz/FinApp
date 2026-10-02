'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input } from '@finapp/ui/web';
import { Plus, UsersThree, ShieldCheck } from '@phosphor-icons/react';
import { GroupCard } from './GroupCard';
import { GroupPage, Metric, s, Tile } from './GroupUI';
import {
  InvitationInbox,
  type IncomingInvitation,
  type InvitationResponse,
} from './IncomingInvitations';
import { FinanceEmptyState } from './FinanceEmptyState';
export type GroupOverviewItem = {
  id: string;
  name: string;
  currency: string;
  icon?: string;
  color?: string;
  memberCount: number;
  balance: string;
  balanceMeaning: string;
  description?: string;
  members?: readonly { name: string; avatarId?: string; avatarUrl?: string | null }[];
  role?: string;
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
  onCreate: () => void;
  onOpenGroup: (id: string) => void;
  onOpenChat: (id: string) => void;
  signedIn: boolean;
  onSignIn: () => void;
  invitations?: readonly IncomingInvitation[];
  invitationsLoading: boolean;
  invitationsError?: string;
  onRespondToInvitation: InvitationResponse;
  showInvitations?: boolean;
};
export function GroupsOverviewScreen(p: GroupsOverviewScreenProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [invitationsOpen, setInvitationsOpen] = useState(!!p.showInvitations);
  useEffect(() => {
    if (p.showInvitations) setInvitationsOpen(true);
  }, [p.showInvitations]);
  const filtered = useMemo(() => {
    const result = p.groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
    return sort === 'name' ? result.sort((a, b) => a.name.localeCompare(b.name)) : result;
  }, [p.groups, query, sort]);
  if (!p.signedIn)
    return (
      <GroupPage>
        <h1>Groups</h1>
        <p className={s.subtitle}>Sign in to view your saved groups and shared expenses.</p>
        <Button onPress={p.onSignIn}>Sign in</Button>
      </GroupPage>
    );
  const balanceValue = (key: 'owed' | 'owing') =>
    p.summaries.length
      ? p.summaries.map((x) => x[key]).join(' · ')
      : p.balancesLoading
        ? 'Loading…'
        : p.groups.length
          ? 'Unavailable'
          : '—';
  return (
    <>
      <GroupPage>
        <header className={s.heading}>
          <div>
            <h1>Groups</h1>
            <p className={s.subtitle}>
              Share expenses, settle up, and keep the conversation going.
            </p>
          </div>
          <div className={s.actions}>
            <Input
              className={s.search}
              aria-label="Search groups"
              placeholder="Search groups…"
              value={query}
              onChangeText={setQuery}
            />
            <Button variant="outline" onPress={() => setInvitationsOpen(true)}>
              Invitations{p.invitations?.length ? ` (${p.invitations.length})` : ''}
            </Button>
            <Button onPress={p.onCreate}>
              <Plus size={18} /> New group
            </Button>
          </div>
        </header>
        <section className={s.metrics}>
          <Metric
            label="You are owed"
            value={balanceValue('owed')}
            note={p.summaries.length ? 'Complete group balances' : 'Full history required'}
            icon="phosphor:ArrowDownLeft"
            color="#65d989"
          />
          <Metric
            label="You owe"
            value={balanceValue('owing')}
            note={p.summaries.length ? 'Across loaded groups' : 'No partial balance shown'}
            icon="phosphor:ArrowUpRight"
            color="#ed7077"
          />
          <Metric
            label="Active groups"
            value={p.loading ? '…' : String(p.groups.length)}
            note="Saved on this device"
            icon="phosphor:UsersThree"
            color="#ac8bf5"
          />
          <Metric
            label="Recorded settlements"
            value={String(p.activities.filter((a) => a.kind === 'settlement').length)}
            note="In recent activity"
            icon="phosphor:Receipt"
            color="#f4cd63"
          />
        </section>
        {p.error && (
          <p className={s.error} role="alert">
            Saved groups could not be read: {p.error}
          </p>
        )}
        <div className={s.columns}>
          <section className={s.stack}>
            <div className={s.panelHead}>
              <h2>Your groups</h2>
              <label className={s.actions}>
                <span className={s.muted}>Sort by</span>
                <select
                  aria-label="Sort groups"
                  value={sort}
                  onChange={(e) => setSort(e.currentTarget.value)}
                >
                  <option value="recent">Saved order</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
            {p.loading ? (
              <section className={s.panel} role="status">
                Loading groups…
              </section>
            ) : p.error ? (
              <Empty
                title="Groups unavailable"
                description="Your saved groups could not be loaded."
                icon={<UsersThree size={25} />}
              />
            ) : !filtered.length ? (
              <FinanceEmptyState
                kind={query ? 'search' : 'group'}
                title={query ? 'No matching groups' : 'No groups yet'}
                description={
                  query
                    ? 'Try another group name.'
                    : 'Create a group for expenses you share with people.'
                }
                action={!query ? <Button onPress={p.onCreate}>Create group</Button> : undefined}
              />
            ) : (
              filtered.map((g) => (
                <GroupCard
                  key={g.id}
                  {...g}
                  meta={`${g.memberCount} members · ${g.currency}`}
                  meaning={g.balanceMeaning}
                  onPress={() => p.onOpenGroup(g.id)}
                  onOpenChat={() => p.onOpenChat(g.id)}
                />
              ))
            )}
          </section>
          <aside className={s.stack}>
            <section className={s.panel}>
              <h3>Settlements</h3>
              <div className={s.tip}>
                <Tile icon="phosphor:ArrowsLeftRight" color="#ac8bf5" />
                <p className={s.muted}>
                  Open a group to see complete member balances and record a settlement.
                </p>
              </div>
              <p className={s.muted}>No scheduled settlement data is available.</p>
            </section>
            <section className={s.panel}>
              <h3>Recent group activity</h3>
              {p.activities.length ? (
                <ul className={s.list}>
                  {p.activities.slice(0, 7).map((a) => (
                    <li key={a.id} className={s.activity}>
                      <Tile
                        icon={
                          a.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight'
                        }
                        color={a.kind === 'expense' ? '#f4cd63' : '#65d989'}
                      />
                      <div className={s.activityCopy}>
                        <strong>{a.title}</strong>
                        <small>
                          {a.groupName} · {a.date}
                        </small>
                      </div>
                      <strong>{a.amount}</strong>
                    </li>
                  ))}
                </ul>
              ) : p.balancesLoading ? (
                <p className={s.muted}>Loading recent activity…</p>
              ) : (
                <FinanceEmptyState
                  kind="activity"
                  compact
                  title="No recent group activity"
                  description="Activity appears here after expenses and settlements are recorded."
                />
              )}
            </section>
            <section className={s.panel}>
              <div className={s.tip}>
                <ShieldCheck size={30} />
                <div>
                  <h3>Roles & permissions</h3>
                  <p>Owners and admins manage members, appearance and chat retention.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </GroupPage>
      <InvitationInbox
        invitations={p.invitations}
        loading={p.invitationsLoading}
        error={p.invitationsError}
        onRespond={p.onRespondToInvitation}
        open={invitationsOpen}
        onClose={() => setInvitationsOpen(false)}
      />
    </>
  );
}
