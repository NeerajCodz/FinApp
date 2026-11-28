'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Button, Input, Tabs } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  UserCell,
} from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';

type GroupRow = {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  owner: Parameters<typeof UserCell>[0]['user'];
  createdAt: number;
  activity30: number;
  openReports: number;
  activity?: number;
};

function GroupTable({ rows, activityLabel }: { rows: GroupRow[]; activityLabel: string }) {
  if (!rows.length) return <Empty>No groups.</Empty>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Owner</th>
            <th>Members</th>
            <th>{activityLabel}</th>
            <th>Reports</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((group) => (
            <tr key={group.id}>
              <td>
                <Link href={`/groups/${group.id}`}>
                  <strong>
                    {group.icon ? `${group.icon} ` : ''}
                    {group.name}
                  </strong>
                </Link>
              </td>
              <td>
                <UserCell user={group.owner} />
              </td>
              <td>{group.memberCount}</td>
              <td>{formatNumber(group.activity ?? group.activity30)}</td>
              <td>{group.openReports ? <Pill tone="bad">{group.openReports} open</Pill> : '—'}</td>
              <td>{formatDate(group.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllGroups() {
  const [search, setSearch] = useState('');
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.activity.listGroups,
    { search: search.trim() || undefined },
    { initialNumItems: 25 },
  );
  return (
    <Panel>
      <div className="admin-toolbar" style={{ marginBottom: 14 }}>
        <Input
          aria-label="Filter loaded groups by name"
          placeholder="Filter by name"
          value={search}
          onChangeText={setSearch}
        />
      </div>
      {status === 'LoadingFirstPage' ? (
        <Loading />
      ) : (
        <GroupTable rows={results} activityLabel="Activity (30d)" />
      )}
      {status === 'CanLoadMore' ? (
        <Button variant="outline" size="sm" onPress={() => loadMore(25)} style={{ marginTop: 12 }}>
          Load more
        </Button>
      ) : null}
    </Panel>
  );
}

function TopGroups() {
  const rows = useQuery(api.admin.activity.topGroups, { days: 30 });
  return (
    <Panel title="Most active groups" description="Messages and ledger events, last 30 days">
      {rows ? <GroupTable rows={rows} activityLabel="Activity" /> : <Loading />}
    </Panel>
  );
}

export default function GroupsPage() {
  const [tab, setTab] = useState('active');
  return (
    <RequirePermission any={['VIEW_GROUPS']}>
      <PageHeader
        title="Groups"
        description="Names, membership and activity counts. Ledgers, amounts and chats are never shown."
      />
      <Tabs
        label="Group views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'Most active' },
          { value: 'all', label: 'All groups' },
        ]}
      />
      {tab === 'active' ? <TopGroups /> : <AllGroups />}
    </RequirePermission>
  );
}
