'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { navFor } from '@/components/Shell';
import { TimeChart, RankBars } from '@/components/charts';
import { Kpi, Loading, PageHeader, Panel, UserCell } from '@/components/ui';
import { useAdmin, useCan } from '@/lib/admin';
import { formatBytes, formatNumber, formatPercent } from '@/lib/format';

function Welcome() {
  const me = useAdmin();
  return (
    <>
      <PageHeader
        title={`Welcome, ${me.user?.displayName ?? 'staff'}`}
        description="Pick a section to get started."
      />
      <div className="admin-kpis">
        {navFor(me)
          .flatMap((section) => section.items)
          .filter((item) => item.href !== '/')
          .map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="admin-kpi" style={{ textDecoration: 'none' }}>
              <Icon size={20} aria-hidden />
              <strong style={{ fontSize: 18 }}>{label}</strong>
            </Link>
          ))}
      </div>
    </>
  );
}

function Dashboard() {
  const overview = useQuery(api.admin.analytics.overview, {});
  const growth = useQuery(api.admin.analytics.growth, { days: 30 });
  const adoption = useQuery(api.admin.analytics.featureAdoption, { days: 30 });
  const top = useQuery(api.admin.analytics.topUsers, { days: 30, limit: 8 });
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Usage across Finapp. Counts only: no financial or personal content."
      />
      {!overview ? (
        <Loading />
      ) : (
        <div className="admin-kpis">
          <Kpi
            label="Total users"
            value={formatNumber(overview.totalUsers, true)}
            hint="daily snapshot"
          />
          <Kpi label="Daily active" value={formatNumber(overview.dau)} />
          <Kpi label="Weekly active" value={formatNumber(overview.wau)} />
          <Kpi label="Monthly active" value={formatNumber(overview.mau)} />
          <Kpi label="DAU / MAU" value={formatPercent(overview.stickiness)} />
          <Kpi
            label="Sign-ups (7d)"
            value={formatNumber(overview.signups7)}
            hint={`${overview.signups30} in 30d`}
          />
          <Kpi label="Sessions (30d)" value={formatNumber(overview.sessions30, true)} />
          <Kpi label="FinAI requests (30d)" value={formatNumber(overview.aiRequests30, true)} />
          <Kpi label="MCP calls (30d)" value={formatNumber(overview.mcpCalls30, true)} />
          <Kpi label="Storage" value={formatBytes(overview.storageBytes)} />
          <Kpi label="Open tickets" value={formatNumber(overview.openTickets)} />
          <Kpi label="Open reports" value={formatNumber(overview.openReports)} />
        </div>
      )}
      <div className="admin-two">
        <Panel title="Active users and sign-ups" description="Last 30 days">
          {growth ? (
            <TimeChart
              data={growth}
              series={[
                { key: 'active', label: 'Active users' },
                { key: 'signups', label: 'Sign-ups' },
              ]}
            />
          ) : (
            <Loading />
          )}
        </Panel>
        <Panel title="Top features" description="Events in the last 30 days">
          {adoption ? (
            <RankBars
              rows={adoption.metrics.slice(0, 8).map((metric) => ({
                label: metric.label,
                value: metric.events,
                hint: `${metric.users} users`,
              }))}
            />
          ) : (
            <Loading />
          )}
        </Panel>
      </div>
      <Panel title="Most active users" description="By event count, last 30 days">
        {!top ? (
          <Loading />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Events</th>
                  <th>Active days</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row, index) => (
                  <tr key={row.user?.id ?? index}>
                    <td>
                      <UserCell user={row.user} />
                    </td>
                    <td>{formatNumber(row.events)}</td>
                    <td>{row.activeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export default function DashboardPage() {
  const can = useCan();
  return can('VIEW_ANALYTICS') ? <Dashboard /> : <Welcome />;
}
