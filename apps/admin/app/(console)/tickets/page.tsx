'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Button, Tabs } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { TICKET_CATEGORIES } from '@convex/support/domain';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  priorityTone,
  Select,
  statusTone,
  UserCell,
} from '@/components/ui';
import { timeAgo } from '@/lib/format';

type Status = 'open' | 'pending' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

function Inbox() {
  const counts = useQuery(api.support.tickets.inboxCounts, {});
  const [view, setView] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [status, setStatus] = useState<Status | ''>('open');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.support.tickets.inbox,
    {
      view,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
    },
    { initialNumItems: 30 },
  );
  return (
    <>
      <Tabs
        label="Ticket views"
        value={view}
        onChange={(value) => setView(value as typeof view)}
        tabs={[
          { value: 'all', label: `All${counts ? ` · ${counts.open} open` : ''}` },
          { value: 'mine', label: `Mine${counts ? ` · ${counts.mine}` : ''}` },
          { value: 'unassigned', label: 'Unassigned' },
        ]}
      />
      <Panel>
        <div className="admin-toolbar" style={{ marginBottom: 14 }}>
          <Select
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as Status | '')}
            options={[
              { value: '', label: 'Any status' },
              { value: 'open', label: 'Open' },
              { value: 'pending', label: 'Pending user' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: '', label: 'Any category' },
              ...Object.entries(TICKET_CATEGORIES).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as Priority | '')}
            options={[
              { value: '', label: 'Any priority' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'normal', label: 'Normal' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
        {loadStatus === 'LoadingFirstPage' ? (
          <Loading />
        ) : results.length === 0 ? (
          <Empty>No tickets match.</Empty>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {results.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="admin-muted">#{ticket.number}</td>
                    <td>
                      <Link href={`/tickets/${ticket.id}`}>
                        <strong>{ticket.subject}</strong>
                      </Link>
                      <div className="admin-actions" style={{ marginTop: 4 }}>
                        <Pill>{ticket.categoryLabel}</Pill>
                        {ticket.aiCategory && ticket.aiCategory !== ticket.category ? (
                          <Pill tone="accent">AI: {ticket.aiCategory}</Pill>
                        ) : null}
                        {ticket.duplicateOf ? <Pill tone="warn">possible duplicate</Pill> : null}
                        {ticket.lastAuthor === 'user' && ticket.status === 'open' ? (
                          <Pill tone="accent">awaiting staff</Pill>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <UserCell user={ticket.user} />
                    </td>
                    <td>
                      <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
                    </td>
                    <td>
                      <Pill tone={priorityTone(ticket.priority)}>{ticket.priority}</Pill>
                    </td>
                    <td>
                      {ticket.assignee ? <UserCell user={ticket.assignee} link={false} /> : '—'}
                    </td>
                    <td>{timeAgo(ticket.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loadStatus === 'CanLoadMore' ? (
          <Button
            variant="outline"
            size="sm"
            onPress={() => loadMore(30)}
            style={{ marginTop: 12 }}
          >
            Load more
          </Button>
        ) : null}
      </Panel>
    </>
  );
}

export default function TicketsPage() {
  return (
    <RequirePermission any={['VIEW_TICKETS']}>
      <PageHeader
        title="Tickets"
        description="Support conversations. Users only share what they write here; their finance data stays private."
        actions={
          <Link href="/tickets/canned">
            <Button variant="outline" size="sm">
              Canned replies
            </Button>
          </Link>
        }
      />
      <Inbox />
    </RequirePermission>
  );
}
