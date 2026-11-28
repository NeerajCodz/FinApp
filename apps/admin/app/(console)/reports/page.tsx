'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { toast } from 'sonner';
import { Button, Dialog, Tabs } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  Select,
  UserCell,
} from '@/components/ui';
import { useCan } from '@/lib/admin';
import { errorText, formatDate } from '@/lib/format';

type Action = 'dismiss' | 'warn' | 'suspend' | 'ban' | 'resolve';

function ActionDialog({
  reportId,
  action,
  onClose,
}: {
  reportId: Id<'reports'>;
  action: Action;
  onClose: () => void;
}) {
  const resolve = useMutation(api.support.reports.resolve);
  const [message, setMessage] = useState('');
  const [hours, setHours] = useState('72');
  const title =
    action === 'warn'
      ? 'Warn the user'
      : action === 'suspend'
        ? 'Suspend the user'
        : action === 'ban'
          ? 'Ban the user'
          : action === 'resolve'
            ? 'Mark handled'
            : 'Dismiss report';
  return (
    <Dialog visible onClose={onClose} title={title}>
      <div className="admin-form">
        {action === 'suspend' ? (
          <Select
            label="Length"
            value={hours}
            onChange={setHours}
            options={[
              { value: '24', label: '1 day' },
              { value: '72', label: '3 days' },
              { value: '168', label: '7 days' },
              { value: '720', label: '30 days' },
            ]}
          />
        ) : null}
        {action !== 'dismiss' && action !== 'resolve' ? (
          <label className="admin-field">
            <span>{action === 'warn' ? 'Message to the user' : 'Reason (shown to the user)'}</span>
            <textarea
              className="admin-textarea"
              value={message}
              maxLength={1000}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
        ) : null}
        <div className="admin-actions">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant={action === 'ban' || action === 'suspend' ? 'destructive' : 'primary'}
            onPress={async () => {
              try {
                await resolve({
                  reportId,
                  action,
                  ...(message.trim() ? { message } : {}),
                  ...(action === 'suspend' ? { durationHours: Number(hours) } : {}),
                });
                toast.success('Report handled');
                onClose();
              } catch (cause) {
                toast.error(errorText(cause));
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Queue({ status }: { status: 'open' | 'dismissed' | 'actioned' }) {
  const can = useCan();
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(api.support.reports.queue, { status }, { initialNumItems: 20 });
  const [pending, setPending] = useState<{ id: Id<'reports'>; action: Action } | null>(null);
  if (loadStatus === 'LoadingFirstPage') return <Loading />;
  if (!results.length) return <Empty>No reports here.</Empty>;
  return (
    <div className="admin-thread">
      {results.map((report) => (
        <Panel key={report.id}>
          <div className="admin-form">
            <div className="admin-actions">
              <Pill tone="bad">{report.reasonLabel}</Pill>
              <Pill>{report.targetType}</Pill>
              <span className="admin-muted">{formatDate(report.createdAt, true)}</span>
              {report.handledBy ? (
                <span className="admin-muted">
                  {report.resolution} by {report.handledBy.displayName}
                </span>
              ) : null}
            </div>
            <dl className="admin-dl">
              <dt>Reported by</dt>
              <dd>
                <UserCell user={report.reporter} />
              </dd>
              {report.targetUser ? (
                <>
                  <dt>User</dt>
                  <dd>
                    <UserCell user={report.targetUser} />
                  </dd>
                </>
              ) : null}
              {report.targetGroup ? (
                <>
                  <dt>Group</dt>
                  <dd>
                    <Link href={`/groups/${report.targetGroup.id}`}>{report.targetGroup.name}</Link>
                  </dd>
                </>
              ) : null}
              {report.targetMessageId ? (
                <>
                  <dt>Message</dt>
                  <dd className="admin-muted">
                    Referenced by id only; message text is never shown to staff.
                  </dd>
                </>
              ) : null}
            </dl>
            <div className="admin-message">
              <header>What the reporter wrote</header>
              <p>{report.description}</p>
            </div>
            {status === 'open' ? (
              <div className="admin-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setPending({ id: report.id, action: 'dismiss' })}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => setPending({ id: report.id, action: 'resolve' })}
                >
                  Mark handled
                </Button>
                {report.targetUser ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setPending({ id: report.id, action: 'warn' })}
                    >
                      Warn
                    </Button>
                    {can('BAN_USERS') ? (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onPress={() => setPending({ id: report.id, action: 'suspend' })}
                        >
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onPress={() => setPending({ id: report.id, action: 'ban' })}
                        >
                          Ban
                        </Button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>
      ))}
      {loadStatus === 'CanLoadMore' ? (
        <Button variant="outline" size="sm" onPress={() => loadMore(20)}>
          Load more
        </Button>
      ) : null}
      {pending ? (
        <ActionDialog
          reportId={pending.id}
          action={pending.action}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'open' | 'dismissed' | 'actioned'>('open');
  return (
    <RequirePermission any={['MANAGE_REPORTS']}>
      <PageHeader
        title="Reports"
        description="User reports. Every action is written to the audit log."
      />
      <Tabs
        label="Report status"
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { value: 'open', label: 'Open' },
          { value: 'actioned', label: 'Actioned' },
          { value: 'dismissed', label: 'Dismissed' },
        ]}
      />
      <Queue key={tab} status={tab} />
    </RequirePermission>
  );
}
