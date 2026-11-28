'use client';

import { useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { Button, Input } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  StatePill,
  UserCell,
} from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/format';

function UsersTable() {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.users.list,
    { search: term || undefined },
    { initialNumItems: 25 },
  );
  return (
    <Panel>
      <form
        className="admin-toolbar"
        style={{ marginBottom: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
        }}
      >
        <Input
          aria-label="Search by username"
          placeholder="Search by username prefix"
          value={search}
          onChangeText={setSearch}
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {term ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setSearch('');
              setTerm('');
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>
      {status === 'LoadingFirstPage' ? (
        <Loading />
      ) : results.length === 0 ? (
        <Empty>No users found.</Empty>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Platform</th>
                <th>Last active</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {results.map((user) => (
                <tr key={user.id}>
                  <td>
                    <UserCell user={user} />
                  </td>
                  <td>
                    <span className="admin-actions">
                      <StatePill state={user.state} />
                      {user.staff ? <Pill tone="accent">staff</Pill> : null}
                    </span>
                  </td>
                  <td>{user.platform ?? '—'}</td>
                  <td>{timeAgo(user.lastActiveAt)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === 'CanLoadMore' ? (
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" size="sm" onPress={() => loadMore(25)}>
            Load more
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

export default function UsersPage() {
  return (
    <RequirePermission any={['VIEW_USERS']}>
      <PageHeader
        title="Users"
        description="Account metadata and usage counts only. Finance data and emails are never shown."
      />
      <UsersTable />
    </RequirePermission>
  );
}
