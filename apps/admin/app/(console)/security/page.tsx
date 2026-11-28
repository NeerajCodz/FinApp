'use client';

import { useState } from 'react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Button } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { TimeChart } from '@/components/charts';
import {
  Empty,
  Kpi,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  Select,
  UserCell,
} from '@/components/ui';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

const KINDS = [
  { value: '', label: 'All events' },
  { value: 'signin.success', label: 'Sign-ins' },
  { value: 'signin.failed', label: 'Failed sign-ins' },
  { value: 'signin.blocked', label: 'Blocked sign-ins' },
  { value: 'mfa.totp_enabled', label: 'Authenticator on' },
  { value: 'mfa.totp_disabled', label: 'Authenticator off' },
  { value: 'mfa.email_enabled', label: 'Email codes on' },
  { value: 'mfa.email_disabled', label: 'Email codes off' },
  { value: 'user.banned', label: 'Bans' },
  { value: 'user.suspended', label: 'Suspensions' },
  { value: 'user.unbanned', label: 'Lifted' },
  { value: 'user.warned', label: 'Warnings' },
  { value: 'sessions.revoked', label: 'Forced sign-outs' },
];

function tone(kind: string) {
  if (kind === 'signin.success' || kind.endsWith('_enabled') || kind === 'user.unbanned')
    return 'good' as const;
  if (kind === 'signin.failed' || kind.endsWith('_disabled') || kind === 'user.warned')
    return 'warn' as const;
  if (kind === 'signin.blocked' || kind === 'user.banned' || kind === 'user.suspended')
    return 'bad' as const;
  return undefined;
}

function Events() {
  const [kind, setKind] = useState('');
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.activity.securityEvents,
    { kind: kind || undefined },
    { initialNumItems: 30 },
  );
  return (
    <Panel
      title="Events"
      description="Failed sign-ins keep only a salted hash of what was typed."
      actions={<Select label="Event type" value={kind} onChange={setKind} options={KINDS} />}
    >
      {status === 'LoadingFirstPage' ? (
        <Loading />
      ) : results.length === 0 ? (
        <Empty>No events.</Empty>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>By</th>
                <th>Identifier hash</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {results.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Pill tone={tone(event.kind)}>{event.kind}</Pill>
                  </td>
                  <td>{event.user ? <UserCell user={event.user} /> : '—'}</td>
                  <td>{event.actor ? <UserCell user={event.actor} /> : '—'}</td>
                  <td>
                    <code className="admin-muted">{event.identifierHash?.slice(0, 12) ?? '—'}</code>
                  </td>
                  <td>{formatDate(event.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === 'CanLoadMore' ? (
        <Button variant="outline" size="sm" onPress={() => loadMore(30)} style={{ marginTop: 12 }}>
          Load more
        </Button>
      ) : null}
    </Panel>
  );
}

function Summary() {
  const summary = useQuery(api.admin.activity.securitySummary, { days: 14 });
  if (!summary) return <Loading />;
  const failed = summary.perDay.reduce((total, day) => total + day.failed, 0);
  const success = summary.perDay.reduce((total, day) => total + day.success, 0);
  return (
    <>
      <div className="admin-kpis">
        <Kpi label="Sign-ins (14d)" value={formatNumber(success)} />
        <Kpi label="Failed sign-ins (14d)" value={formatNumber(failed)} />
        <Kpi
          label="Failure rate"
          value={formatPercent(success + failed ? failed / (success + failed) : 0)}
        />
        <Kpi
          label="MFA adoption"
          value={formatPercent(summary.mfa.adoption)}
          hint={`${summary.mfa.anyFactor} of ${summary.mfa.totalUsers} users`}
        />
        <Kpi label="Authenticator app" value={formatNumber(summary.mfa.authenticatorApp)} />
        <Kpi label="Email codes" value={formatNumber(summary.mfa.emailCode)} />
      </div>
      <div className="admin-two">
        <Panel title="Sign-in outcomes" description="Last 14 days">
          <TimeChart
            kind="bar"
            data={summary.perDay}
            series={[
              { key: 'success', label: 'Succeeded' },
              { key: 'failed', label: 'Failed' },
              { key: 'blocked', label: 'Blocked' },
            ]}
          />
        </Panel>
        <Panel title="Most failed identifiers" description="Salted hashes, never the identifier">
          {summary.topFailing.length === 0 ? (
            <Empty>No failed sign-ins.</Empty>
          ) : (
            <table className="admin-table">
              <tbody>
                {summary.topFailing.map((row) => (
                  <tr key={row.identifierHash}>
                    <td>
                      <code>{row.identifierHash.slice(0, 16)}</code>
                    </td>
                    <td>{row.count} failures</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function SecurityPage() {
  return (
    <RequirePermission any={['VIEW_SECURITY']}>
      <PageHeader
        title="Security"
        description="Sign-ins, failed sign-ins, MFA and moderation events."
      />
      <Summary />
      <Events />
    </RequirePermission>
  );
}
