'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Avatar, Button, Dialog } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { RankBars } from '@/components/charts';
import {
  Empty,
  Kpi,
  Loading,
  Panel,
  Pill,
  RequirePermission,
  RoleChip,
  Select,
  StatePill,
  UserCell,
} from '@/components/ui';
import { errorText, formatDate, timeAgo } from '@/lib/format';

const DURATIONS = [
  { value: '24', label: '1 day' },
  { value: '72', label: '3 days' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
];

function RestrictDialog({
  userId,
  open,
  onClose,
}: {
  userId: Id<'users'>;
  open: boolean;
  onClose: () => void;
}) {
  const restrict = useMutation(api.admin.users.restrict);
  const [kind, setKind] = useState<'suspension' | 'ban'>('suspension');
  const [duration, setDuration] = useState('72');
  const [reason, setReason] = useState('');
  return (
    <Dialog visible={open} onClose={onClose} title="Suspend or ban">
      <div className="admin-form">
        <Select
          label="Action"
          value={kind}
          onChange={(value) => setKind(value as 'suspension' | 'ban')}
          options={[
            { value: 'suspension', label: 'Temporary suspension' },
            { value: 'ban', label: 'Permanent ban' },
          ]}
        />
        {kind === 'suspension' ? (
          <Select label="Length" value={duration} onChange={setDuration} options={DURATIONS} />
        ) : null}
        <label className="admin-field">
          <span>Reason (the user sees this; stored encrypted)</span>
          <textarea
            className="admin-textarea"
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <p className="admin-muted" style={{ margin: 0 }}>
          This signs the user out everywhere and disconnects their MCP apps.
        </p>
        <div className="admin-actions">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onPress={async () => {
              try {
                await restrict({
                  userId,
                  kind,
                  reason,
                  ...(kind === 'suspension' ? { durationHours: Number(duration) } : {}),
                });
                toast.success(kind === 'ban' ? 'User banned' : 'User suspended');
                setReason('');
                onClose();
              } catch (cause) {
                toast.error(errorText(cause));
              }
            }}
          >
            {kind === 'ban' ? 'Ban user' : 'Suspend user'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function UserDetail({ userId }: { userId: Id<'users'> }) {
  const user = useQuery(api.admin.users.detail, { userId });
  const lift = useMutation(api.admin.users.liftRestriction);
  const revoke = useMutation(api.admin.users.revokeSessions);
  const addNote = useMutation(api.admin.users.addNote);
  const deleteNote = useMutation(api.admin.users.deleteNote);
  const warn = useMutation(api.admin.users.warn);
  const [restrictOpen, setRestrictOpen] = useState(false);
  const [note, setNote] = useState('');
  const [warning, setWarning] = useState('');
  if (user === undefined) return <Loading />;
  if (user === null) return <Empty>User not found.</Empty>;
  const run = (work: () => Promise<unknown>, done: string) => async () => {
    try {
      await work();
      toast.success(done);
    } catch (cause) {
      toast.error(errorText(cause));
    }
  };
  return (
    <>
      <Link href="/users" className="admin-muted" style={{ display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={16} aria-hidden /> Users
      </Link>
      <header className="admin-page-header">
        <div className="admin-user" style={{ gap: 16 }}>
          <Avatar
            initials={user.displayName.slice(0, 2)}
            size={64}
            imageUrl={user.avatarUrl}
            avatarId={user.avatarId ?? undefined}
          />
          <div>
            <h1 style={{ fontSize: 26 }}>{user.displayName}</h1>
            <span className="admin-actions">
              <span className="admin-muted">
                {user.username ? `@${user.username}` : 'no username'}
              </span>
              <StatePill state={user.state} />
              {user.roles.map((role) => (
                <RoleChip key={role.id} role={role} />
              ))}
            </span>
          </div>
        </div>
        <div className="admin-actions">
          {user.permissions.manage ? (
            <Button
              variant="outline"
              onPress={run(() => revoke({ userId }), 'Signed out everywhere')}
            >
              Force sign-out
            </Button>
          ) : null}
          {user.permissions.moderate ? (
            user.state === 'suspended' || user.state === 'banned' ? (
              <Button variant="outline" onPress={run(() => lift({ userId }), 'Restriction lifted')}>
                Lift {user.state === 'banned' ? 'ban' : 'suspension'}
              </Button>
            ) : (
              <Button variant="destructive" onPress={() => setRestrictOpen(true)}>
                Suspend or ban
              </Button>
            )
          ) : null}
        </div>
      </header>

      <div className="admin-kpis">
        <Kpi label="Joined" value={formatDate(user.createdAt)} />
        <Kpi label="Last active" value={timeAgo(user.lastActiveAt)} />
        <Kpi label="Platform" value={user.platform ?? '—'} />
        <Kpi label="Active days (30d)" value={user.usage.activeDays} />
        <Kpi label="Groups" value={user.groupCount} />
        <Kpi label="Two-factor" value={user.mfaEnabled ? 'On' : 'Off'} />
        <Kpi
          label="Reports against"
          value={user.reportsAgainst.total}
          hint={`${user.reportsAgainst.open} open`}
        />
      </div>

      <div className="admin-two">
        <Panel title="Feature usage" description="Event counts in the last 30 days">
          <RankBars
            rows={user.usage.features.map((feature) => ({
              label: feature.label,
              value: feature.count,
            }))}
          />
        </Panel>
        <Panel title="Signed-in devices">
          {user.sessions.length === 0 ? (
            <Empty>No active sessions (or no permission to see them).</Empty>
          ) : (
            <table className="admin-table">
              <tbody>
                {user.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.label}</td>
                    <td>{session.platform ?? '—'}</td>
                    <td className="admin-muted">active {timeAgo(session.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {user.permissions.moderate || user.permissions.manage ? (
        <div className="admin-two">
          <Panel title="Staff notes" description="Only staff see these. Stored encrypted.">
            <div className="admin-form">
              <textarea
                className="admin-textarea"
                placeholder="Add a note"
                value={note}
                maxLength={4000}
                onChange={(event) => setNote(event.target.value)}
              />
              <div>
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onPress={run(async () => {
                    await addNote({ userId, body: note });
                    setNote('');
                  }, 'Note added')}
                >
                  Add note
                </Button>
              </div>
              {user.notes.map((item) => (
                <div key={item.id} className="admin-message">
                  <header>
                    <UserCell user={item.author} />
                    <span>{formatDate(item.createdAt, true)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={run(() => deleteNote({ noteId: item.id }), 'Note deleted')}
                    >
                      Delete
                    </Button>
                  </header>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Moderation history">
            {user.restrictions.length === 0 ? (
              <Empty>No bans or suspensions.</Empty>
            ) : (
              <div className="admin-thread">
                {user.restrictions.map((item) => (
                  <div key={item.id} className="admin-message">
                    <header>
                      <Pill tone={item.active ? 'bad' : undefined}>
                        {item.kind}
                        {item.active ? ' · active' : ''}
                      </Pill>
                      <span>{formatDate(item.createdAt, true)}</span>
                      {item.expiresAt ? (
                        <span>until {formatDate(item.expiresAt, true)}</span>
                      ) : null}
                      {item.liftedAt ? <span>lifted {formatDate(item.liftedAt)}</span> : null}
                    </header>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
            {user.permissions.moderate ? (
              <div className="admin-form" style={{ marginTop: 14 }}>
                <textarea
                  className="admin-textarea"
                  placeholder="Send a warning (goes to the user’s notifications)"
                  value={warning}
                  maxLength={1000}
                  onChange={(event) => setWarning(event.target.value)}
                />
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!warning.trim()}
                    onPress={run(async () => {
                      await warn({ userId, message: warning });
                      setWarning('');
                    }, 'Warning sent')}
                  >
                    Send warning
                  </Button>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {user.security.length ? (
        <Panel title="Security events">
          <table className="admin-table">
            <tbody>
              {user.security.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Pill>{event.kind}</Pill>
                  </td>
                  <td>{event.platform ?? ''}</td>
                  <td className="admin-muted">{formatDate(event.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
      <RestrictDialog userId={userId} open={restrictOpen} onClose={() => setRestrictOpen(false)} />
    </>
  );
}

export default function UserPage() {
  const params = useParams<{ userId: string }>();
  return (
    <RequirePermission any={['VIEW_USERS']}>
      <UserDetail userId={params.userId as Id<'users'>} />
    </RequirePermission>
  );
}
