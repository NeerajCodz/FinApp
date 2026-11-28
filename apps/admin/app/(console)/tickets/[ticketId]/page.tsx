'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAction, useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button, Input, Switch } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { TICKET_CATEGORIES } from '@convex/support/domain';
import {
  Empty,
  Loading,
  Panel,
  Pill,
  priorityTone,
  RequirePermission,
  RoleChip,
  Select,
  statusTone,
  UserCell,
} from '@/components/ui';
import { useAdmin } from '@/lib/admin';
import { errorText, formatDate } from '@/lib/format';

type Status = 'open' | 'pending' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

function Composer({ ticketId, canManage }: { ticketId: Id<'supportTickets'>; canManage: boolean }) {
  const reply = useMutation(api.support.tickets.staffReply);
  const canned = useQuery(api.support.tickets.cannedReplies, {});
  const suggest = useAction(api.support.ai.suggestReply);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [then, setThen] = useState<Status | ''>('');
  const [thinking, setThinking] = useState(false);
  if (!canManage)
    return <p className="admin-muted">You can read tickets but not reply (MANAGE_TICKETS).</p>;
  return (
    <div className="admin-form">
      <div className="admin-toolbar">
        <Select
          label="Insert canned reply"
          value=""
          onChange={(id) => {
            const item = canned?.find((row) => row.id === id);
            if (item) setText((current) => (current ? `${current}\n\n${item.body}` : item.body));
          }}
          options={[
            { value: '', label: canned?.length ? 'Insert canned reply…' : 'No canned replies' },
            ...(canned ?? []).map((row) => ({ value: row.id, label: row.title })),
          ]}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={thinking}
          onPress={async () => {
            setThinking(true);
            try {
              setText(await suggest({ ticketId }));
            } catch (cause) {
              toast.error(errorText(cause));
            } finally {
              setThinking(false);
            }
          }}
        >
          <Sparkles size={15} aria-hidden /> {thinking ? 'Drafting…' : 'Suggest reply'}
        </Button>
      </div>
      <textarea
        className="admin-textarea"
        style={{ minHeight: 140 }}
        aria-label={internal ? 'Internal note' : 'Reply to user'}
        placeholder={internal ? 'Internal note (staff only)' : 'Reply to the user'}
        value={text}
        maxLength={5000}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
        <Switch label="Internal note" value={internal} onValueChange={setInternal} />
        <div className="admin-actions">
          {!internal ? (
            <Select
              label="Then set status"
              value={then}
              onChange={(value) => setThen(value as Status | '')}
              options={[
                { value: '', label: 'Keep status' },
                { value: 'resolved', label: 'and resolve' },
                { value: 'closed', label: 'and close' },
              ]}
            />
          ) : null}
          <Button
            disabled={!text.trim()}
            onPress={async () => {
              try {
                await reply({
                  ticketId,
                  message: text,
                  internal,
                  ...(then && !internal ? { status: then } : {}),
                });
                setText('');
                setThen('');
                toast.success(internal ? 'Note added' : 'Reply sent');
              } catch (cause) {
                toast.error(errorText(cause));
              }
            }}
          >
            {internal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AiPanel({
  ticketId,
  ai,
  canManage,
}: {
  ticketId: Id<'supportTickets'>;
  ai: {
    category: string | null;
    priority: string | null;
    summary: string | null;
    triagedAt: number | null;
    duplicateOf: { id: string; number: number } | null;
  };
  canManage: boolean;
}) {
  const summarize = useAction(api.support.ai.summarize);
  const retriage = useAction(api.support.ai.retriage);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="AI assist"
      description="Uses only this ticket's text. Never the user's finance data."
    >
      <dl className="admin-dl">
        <dt>Category</dt>
        <dd>{ai.category ?? '—'}</dd>
        <dt>Priority</dt>
        <dd>{ai.priority ?? '—'}</dd>
        <dt>Duplicate of</dt>
        <dd>
          {ai.duplicateOf ? (
            <Link href={`/tickets/${ai.duplicateOf.id}`}>#{ai.duplicateOf.number}</Link>
          ) : (
            '—'
          )}
        </dd>
        <dt>Triaged</dt>
        <dd>{ai.triagedAt ? formatDate(ai.triagedAt, true) : 'not yet'}</dd>
      </dl>
      <div className="admin-message" style={{ marginTop: 12 }}>
        <header>Summary</header>
        <p>{ai.summary ?? 'No summary yet.'}</p>
      </div>
      {canManage ? (
        <div className="admin-actions" style={{ marginTop: 12 }}>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => run(() => summarize({ ticketId }))}
          >
            <Sparkles size={15} aria-hidden /> Summarize thread
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onPress={() => run(() => retriage({ ticketId }))}
          >
            Re-run triage
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function Properties({
  ticket,
}: {
  ticket: {
    id: Id<'supportTickets'>;
    status: Status;
    priority: Priority;
    category: string;
    assignee: { id: string; username: string | null } | null;
    canManage: boolean;
  };
}) {
  const me = useAdmin();
  const update = useMutation(api.support.tickets.update);
  const [assignee, setAssignee] = useState('');
  const change = async (patch: Parameters<typeof update>[0]) => {
    try {
      await update(patch);
    } catch (cause) {
      toast.error(errorText(cause));
    }
  };
  const disabled = !ticket.canManage;
  return (
    <Panel title="Ticket">
      <div className="admin-form">
        <label className="admin-field">
          <span>Status</span>
          <select
            className="admin-select"
            value={ticket.status}
            disabled={disabled}
            onChange={(event) =>
              change({ ticketId: ticket.id, status: event.target.value as Status })
            }
          >
            <option value="open">Open</option>
            <option value="pending">Pending user</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Priority</span>
          <select
            className="admin-select"
            value={ticket.priority}
            disabled={disabled}
            onChange={(event) =>
              change({ ticketId: ticket.id, priority: event.target.value as Priority })
            }
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Category</span>
          <select
            className="admin-select"
            value={ticket.category}
            disabled={disabled}
            onChange={(event) => change({ ticketId: ticket.id, category: event.target.value })}
          >
            {Object.entries(TICKET_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-field">
          <span>Assignee</span>
          <div>{ticket.assignee?.username ? `@${ticket.assignee.username}` : 'Unassigned'}</div>
          {!disabled ? (
            <div className="admin-actions">
              {ticket.assignee?.id !== me.user?.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => change({ ticketId: ticket.id, claim: true })}
                >
                  Claim
                </Button>
              ) : null}
              {ticket.assignee ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => change({ ticketId: ticket.id, assigneeUsername: null })}
                >
                  Unassign
                </Button>
              ) : null}
            </div>
          ) : null}
          {!disabled ? (
            <form
              className="admin-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                void change({ ticketId: ticket.id, assigneeUsername: assignee.trim() });
                setAssignee('');
              }}
            >
              <Input
                aria-label="Assign to staff username"
                placeholder="Assign to @username"
                value={assignee}
                onChangeText={setAssignee}
              />
              <Button size="sm" type="submit" variant="outline" disabled={!assignee.trim()}>
                Assign
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function TicketView({ ticketId }: { ticketId: Id<'supportTickets'> }) {
  const ticket = useQuery(api.support.tickets.staffDetail, { ticketId });
  if (ticket === undefined) return <Loading />;
  if (ticket === null) return <Empty>Ticket not found.</Empty>;
  return (
    <>
      <Link href="/tickets" className="admin-muted" style={{ display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={16} aria-hidden /> Tickets
      </Link>
      <header className="admin-page-header">
        <div>
          <h1 style={{ fontSize: 24 }}>
            <span className="admin-muted">#{ticket.number}</span> {ticket.subject}
          </h1>
          <div className="admin-actions" style={{ marginTop: 6 }}>
            <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
            <Pill tone={priorityTone(ticket.priority)}>{ticket.priority}</Pill>
            <Pill>{ticket.categoryLabel}</Pill>
            <span className="admin-muted">opened {formatDate(ticket.createdAt, true)}</span>
          </div>
        </div>
        <UserCell user={ticket.user} />
      </header>
      <div className="admin-ticket">
        <div className="admin-grid">
          <Panel
            title="Conversation"
            description="Transcript is kept. Yellow notes are staff-only."
          >
            <div className="admin-thread">
              {ticket.messages.map((message) => (
                <article
                  key={message.id}
                  className="admin-message"
                  data-author={message.author}
                  data-internal={message.internal}
                >
                  <header>
                    {message.author === 'system' ? null : (
                      <UserCell user={message.user} link={message.author === 'user'} />
                    )}
                    {message.staffBadge ? <RoleChip role={message.staffBadge} /> : null}
                    {message.internal ? <Pill tone="warn">internal</Pill> : null}
                    <span style={{ marginLeft: 'auto' }}>
                      {formatDate(message.createdAt, true)}
                    </span>
                  </header>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Reply">
            <Composer ticketId={ticket.id} canManage={ticket.canManage} />
          </Panel>
        </div>
        <div className="admin-grid">
          <Properties ticket={ticket} />
          <AiPanel ticketId={ticket.id} ai={ticket.ai} canManage={ticket.canManage} />
          <Panel title="Other tickets from this user">
            {ticket.otherTickets.length === 0 ? (
              <Empty>None.</Empty>
            ) : (
              <div className="admin-thread">
                {ticket.otherTickets.map((other) => (
                  <Link key={other.id} href={`/tickets/${other.id}`}>
                    <span className="admin-muted">#{other.number}</span> {other.subject}{' '}
                    <Pill tone={statusTone(other.status)}>{other.status}</Pill>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function TicketPage() {
  const params = useParams<{ ticketId: string }>();
  return (
    <RequirePermission any={['VIEW_TICKETS']}>
      <TicketView ticketId={params.ticketId as Id<'supportTickets'>} />
    </RequirePermission>
  );
}
