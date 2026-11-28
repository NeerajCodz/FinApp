'use client';

import Link from 'next/link';
import { usePaginatedQuery } from 'convex/react';
import { Button } from '@finapp/ui/web';
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
import { formatDate } from '@/lib/format';

function targetHref(type: string, id: string | null) {
  if (!id) return null;
  if (type === 'user') return `/users/${id}`;
  if (type === 'ticket') return `/tickets/${id}`;
  if (type === 'group') return `/groups/${id}`;
  return null;
}

function AuditTable() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.activity.auditLog,
    {},
    { initialNumItems: 40 },
  );
  if (status === 'LoadingFirstPage') return <Loading />;
  if (!results.length) return <Empty>No admin actions yet.</Empty>;
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Staff</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {results.map((entry) => {
              const href = targetHref(entry.targetType, entry.targetId);
              return (
                <tr key={entry.id}>
                  <td>{formatDate(entry.createdAt, true)}</td>
                  <td>
                    <UserCell user={entry.actor} />
                  </td>
                  <td>
                    <Pill tone="accent">{entry.action}</Pill>
                  </td>
                  <td>{href ? <Link href={href}>{entry.targetType}</Link> : entry.targetType}</td>
                  <td className="admin-muted">{entry.detail ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {status === 'CanLoadMore' ? (
        <Button variant="outline" size="sm" onPress={() => loadMore(40)} style={{ marginTop: 12 }}>
          Load more
        </Button>
      ) : null}
    </>
  );
}

export default function AuditPage() {
  return (
    <RequirePermission any={['VIEW_AUDIT_LOG']}>
      <PageHeader title="Audit log" description="Every staff action, newest first." />
      <Panel>
        <AuditTable />
      </Panel>
    </RequirePermission>
  );
}
