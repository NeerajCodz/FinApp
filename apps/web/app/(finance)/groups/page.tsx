'use client';

import Link from 'next/link';
import { ArrowRight, Plus, UsersRound } from 'lucide-react';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};
type Member = LocalRecord & { groupId?: string; userId?: string; role?: string };
const ids = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupsPage() {
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Group>('group');
  const { records: memberships } = useLocalRecords<Member>('groupMember');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const phoneVerified = Boolean(
    profiles[0]?.phone && profiles[0]?.phoneVerificationTime !== undefined,
  );

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SHARED FINANCES</p>
        <h1>Make room for the group.</h1>
        <p>Sign in to view groups saved in this browser or create a new shared space.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  const groups = records;
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">SHARED LEDGERS</p>
          <h1>Groups</h1>
          <p className="finance-muted">
            {groups.length
              ? `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`
              : 'Your groups will appear here when available.'}
          </p>
        </div>
        <Link className="finance-primary-link" href="/group/new">
          <Plus size={16} /> Create group
        </Link>
      </header>
      <section className="finance-record-panel" aria-labelledby="people-to-split-title">
        <SectionHeader title="People to split with" />
        <div className="finance-record-item">
          <span className="finance-record-symbol">
            <UsersRound size={17} />
          </span>
          <span className="finance-record-copy">
            <strong>Invite someone to a shared ledger</strong>
            <small>
              {phoneVerified
                ? 'Choose one contact or add people by username in the invite form.'
                : 'Add people by username. Selected contacts unlock after manual phone verification.'}
            </small>
          </span>
          <Link className="finance-secondary-action" href="/group/new">
            Invite people <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {error && (
        <p className="finance-form-error" role="alert">
          Saved groups could not be read: {error}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Your groups"
          action={<Badge variant="neutral">{groups.length} total</Badge>}
        />
        {loading ? (
          <p className="finance-muted" role="status">
            Opening saved groups…
          </p>
        ) : groups.length === 0 ? (
          <Empty
            title="No groups yet"
            description="Create one for a trip, home, or any expense shared with people."
            icon={<UsersRound size={20} />}
            action={
              <Link className="finance-secondary-action" href="/group/new">
                Create group <ArrowRight size={15} />
              </Link>
            }
          />
        ) : (
          <ul className="finance-record-list">
            {groups.map((group) => {
              const groupIds = ids(group);
              const memberCount =
                memberships.filter(
                  (member) =>
                    typeof member.groupId === 'string' && groupIds.includes(member.groupId),
                ).length || (group.ownerId ? 1 : 0);
              const id = idOf(group);
              return (
                <li key={id}>
                  <span className="finance-record-symbol">
                    <UsersRound size={17} />
                  </span>
                  <span className="finance-record-copy">
                    <strong>{group.name ?? 'Shared group'}</strong>
                    <small>
                      {group.currency ?? 'INR'} · shared ledger · {memberCount}{' '}
                      {memberCount === 1 ? 'member' : 'members'}
                      {group.ownerId === userId ? ' · owner' : ''}
                    </small>
                  </span>
                  <Link
                    className="finance-secondary-action"
                    href={`/group/${encodeURIComponent(id)}`}
                  >
                    Open <ArrowRight size={15} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link className="finance-secondary-action" href="/settle/new">
          Settle up <ArrowRight size={15} />
        </Link>
      </Card>
    </div>
  );
}
