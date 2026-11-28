'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { ArrowLeft } from 'lucide-react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { TimeChart } from '@/components/charts';
import { Empty, Kpi, Loading, Panel, RequirePermission, UserCell } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { dayStart, DAY_MS } from '@convex/admin/usageMetrics';

function GroupDetail({ groupId }: { groupId: Id<'groups'> }) {
  const group = useQuery(api.admin.activity.groupDetail, { groupId });
  if (group === undefined) return <Loading />;
  if (group === null) return <Empty>Group not found.</Empty>;
  const start = dayStart(Date.now()) - 89 * DAY_MS;
  const byDay = new Map(group.activity.map((row) => [row.day, row.count]));
  const series = Array.from({ length: 90 }, (_, index) => {
    const day = start + index * DAY_MS;
    return { day, count: byDay.get(day) ?? 0 };
  });
  return (
    <>
      <Link href="/groups" className="admin-muted" style={{ display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={16} aria-hidden /> Groups
      </Link>
      <h1 style={{ fontSize: 26 }}>
        {group.icon ? `${group.icon} ` : ''}
        {group.name}
      </h1>
      <div className="admin-kpis">
        <Kpi label="Members" value={group.memberCount} />
        <Kpi label="Activity (30d)" value={formatNumber(group.activity30)} />
        <Kpi label="Created" value={formatDate(group.createdAt)} />
        <Kpi label="Open reports" value={group.openReports} />
        <Kpi label="Status" value={group.archived ? 'Archived' : 'Active'} />
      </div>
      <Panel title="Activity" description="Messages and ledger events per day (counts only)">
        <TimeChart kind="bar" data={series} series={[{ key: 'count', label: 'Events' }]} />
      </Panel>
      <Panel title="Members">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((member, index) => (
              <tr key={member.user?.id ?? index}>
                <td>
                  <UserCell user={member.user} />
                </td>
                <td>{member.role}</td>
                <td>{formatDate(member.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  return (
    <RequirePermission any={['VIEW_GROUPS']}>
      <GroupDetail groupId={params.groupId as Id<'groups'>} />
    </RequirePermission>
  );
}
