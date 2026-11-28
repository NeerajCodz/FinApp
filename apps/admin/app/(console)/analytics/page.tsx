'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { Tabs } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { RankBars, SplitChart, TimeChart } from '@/components/charts';
import { Kpi, Loading, PageHeader, Panel, RequirePermission, Select } from '@/components/ui';
import { formatBytes, formatDay, formatNumber, formatPercent } from '@/lib/format';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function Usage({ days }: { days: number }) {
  const growth = useQuery(api.admin.analytics.growth, { days });
  const sessions = useQuery(api.admin.analytics.timeSeries, {
    metrics: ['session.start', 'transaction.create', 'chat.group_message', 'chat.direct_message'],
    days,
  });
  return (
    <div className="admin-two">
      <Panel title="Active users and sign-ups">
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
      <Panel title="Activity" description="Sessions, transactions added and chat messages">
        {sessions ? (
          <TimeChart
            kind="line"
            data={sessions}
            series={[
              { key: 'session.start', label: 'Sign-ins' },
              { key: 'transaction.create', label: 'Transactions' },
              { key: 'chat.group_message', label: 'Group messages' },
              { key: 'chat.direct_message', label: 'Direct messages' },
            ]}
          />
        ) : (
          <Loading />
        )}
      </Panel>
    </div>
  );
}

function Features({ days }: { days: number }) {
  const adoption = useQuery(api.admin.analytics.featureAdoption, { days });
  if (!adoption) return <Loading />;
  return (
    <div className="admin-two">
      <Panel title="Events per feature">
        <RankBars
          rows={adoption.metrics
            .filter((metric) => metric.events > 0)
            .map((metric) => ({ label: metric.label, value: metric.events }))}
        />
      </Panel>
      <Panel
        title="Adoption"
        description={`Share of ${adoption.activeUsers} active users who used each feature`}
      >
        <RankBars
          format={formatPercent}
          rows={adoption.metrics
            .filter((metric) => metric.users > 0)
            .sort((a, b) => b.adoption - a.adoption)
            .map((metric) => ({
              label: metric.label,
              value: metric.adoption,
              hint: `${metric.users} users`,
            }))}
        />
      </Panel>
    </div>
  );
}

function Retention() {
  const cohorts = useQuery(api.admin.analytics.retention, { weeks: 8 });
  if (!cohorts) return <Loading />;
  const width = Math.max(...cohorts.map((cohort) => cohort.retained.length), 1);
  return (
    <Panel title="Weekly retention" description="Share of each sign-up week active in later weeks">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Users</th>
              {Array.from({ length: width }, (_, index) => (
                <th key={index}>W{index}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.week}>
                <td>{formatDay(cohort.week)}</td>
                <td>{cohort.size}</td>
                {Array.from({ length: width }, (_, index) => {
                  const value = cohort.retained[index];
                  return (
                    <td
                      key={index}
                      style={
                        value === undefined
                          ? undefined
                          : {
                              background: `color-mix(in srgb, var(--finapp-primary) ${Math.round(
                                value * 70,
                              )}%, transparent)`,
                            }
                      }
                    >
                      {value === undefined || !cohort.size ? '' : formatPercent(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Platforms() {
  const platforms = useQuery(api.admin.analytics.platforms, {});
  if (!platforms) return <Loading />;
  return (
    <div className="admin-two">
      <Panel title="Users by platform" description="Last platform of users active in 30 days">
        <SplitChart
          data={platforms.users.map((row) => ({ label: row.platform, value: row.count }))}
        />
      </Panel>
      <Panel title="Signed-in devices" description="Sessions active in the last 30 days">
        <SplitChart
          data={platforms.sessions.map((row) => ({ label: row.platform, value: row.count }))}
        />
      </Panel>
    </div>
  );
}

function AiMcp({ days }: { days: number }) {
  const ai = useQuery(api.admin.analytics.aiUsage, { days });
  if (!ai) return <Loading />;
  return (
    <>
      <div className="admin-kpis">
        <Kpi label="FinAI requests" value={formatNumber(ai.totals['ai.chat'], true)} />
        <Kpi label="Receipt scans" value={formatNumber(ai.totals['ai.ocr'], true)} />
        <Kpi label="Prompt tokens" value={formatNumber(ai.totals['ai.tokens.prompt'], true)} />
        <Kpi label="Output tokens" value={formatNumber(ai.totals['ai.tokens.output'], true)} />
        <Kpi label="MCP tool calls" value={formatNumber(ai.totals['mcp.tool_call'], true)} />
        <Kpi
          label="MCP connections"
          value={formatNumber(ai.mcp.activeConnections)}
          hint={`${ai.mcp.connectedUsers} users`}
        />
        <Kpi label="OAuth clients" value={formatNumber(ai.mcp.clients)} />
        <Kpi
          label="BYOK keys"
          value={formatNumber(ai.byok.keys)}
          hint={`${ai.byok.activeKeys} active`}
        />
      </div>
      <div className="admin-two">
        <Panel title="AI requests">
          <TimeChart
            kind="bar"
            data={ai.series}
            series={[
              { key: 'ai.chat', label: 'FinAI' },
              { key: 'ai.ocr', label: 'Receipts' },
              { key: 'ai.utility', label: 'Utility' },
              { key: 'ai.support', label: 'Support AI' },
            ]}
          />
        </Panel>
        <Panel title="Tokens and MCP calls">
          <TimeChart
            kind="line"
            data={ai.series}
            series={[
              { key: 'ai.tokens.prompt', label: 'Prompt tokens' },
              { key: 'ai.tokens.output', label: 'Output tokens' },
              { key: 'mcp.tool_call', label: 'MCP calls' },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function Storage({ days }: { days: number }) {
  const storage = useQuery(api.admin.analytics.storage, { days });
  if (!storage) return <Loading />;
  return (
    <>
      <div className="admin-kpis">
        <Kpi label="Stored" value={formatBytes(storage.storage?.value)} hint="daily snapshot" />
        <Kpi label="Files" value={formatNumber(storage.files?.value)} />
        <Kpi label="Uploaded (range)" value={formatBytes(storage.uploadedBytes)} />
        <Kpi label="Uploads (range)" value={formatNumber(storage.uploadedFiles)} />
      </div>
      <div className="admin-two">
        <Panel title="Upload bandwidth">
          <TimeChart
            kind="bar"
            data={storage.series}
            format={formatBytes}
            series={[{ key: 'uploadBytes', label: 'Uploaded' }]}
          />
        </Panel>
        <Panel title="Storage over time">
          <TimeChart
            data={storage.series}
            format={formatBytes}
            series={[{ key: 'storageBytes', label: 'Stored' }]}
          />
        </Panel>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('usage');
  const [range, setRange] = useState('30');
  const days = Number(range);
  return (
    <RequirePermission any={['VIEW_ANALYTICS']}>
      <PageHeader
        title="Analytics"
        description="Usage, features, retention, platforms, AI/MCP and storage. Aggregates only."
        actions={<Select label="Range" value={range} onChange={setRange} options={RANGES} />}
      />
      <Tabs
        label="Analytics sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'usage', label: 'Usage' },
          { value: 'features', label: 'Features' },
          { value: 'retention', label: 'Retention' },
          { value: 'platforms', label: 'Platforms' },
          { value: 'ai', label: 'AI and MCP' },
          { value: 'storage', label: 'Storage' },
        ]}
      />
      {tab === 'usage' ? <Usage days={days} /> : null}
      {tab === 'features' ? <Features days={days} /> : null}
      {tab === 'retention' ? <Retention /> : null}
      {tab === 'platforms' ? <Platforms /> : null}
      {tab === 'ai' ? <AiMcp days={days} /> : null}
      {tab === 'storage' ? <Storage days={days} /> : null}
    </RequirePermission>
  );
}
