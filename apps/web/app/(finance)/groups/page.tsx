'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, UsersRound } from 'lucide-react';
import { Card, Empty, SectionHeader } from '@finapp/ui/web';
import { GroupCard, PeopleRail } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupsPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Group>('group');
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
          <p className="finance-kicker">SHARED FINANCES</p>
          <h1>Groups</h1>
          <p className="finance-muted">Keep shared plans, people, and balances together.</p>
        </div>
        <Link className="finance-secondary-action" href="/group/new" aria-label="Create group">
          <Plus size={20} />
          <span>Create group</span>
        </Link>
      </header>
      <section style={{ display: 'grid', gap: 6 }} aria-label="Group overview">
        <strong>Shared ledgers</strong>
        <p className="finance-muted" aria-live="polite">
          {loading
            ? 'Loading your groups…'
            : error
              ? 'Your groups are temporarily unavailable.'
              : `${groups.length} ${groups.length === 1 ? 'group' : 'groups'} saved on this device`}
        </p>
      </section>
      <PeopleRail
        title="People to split with"
        phoneVerified={phoneVerified}
        onChoose={() => router.push('/group/new')}
      />

      {error && (
        <p className="finance-form-error" role="alert">
          Saved groups could not be read: {error}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader title="Your groups" />
        {loading ? (
          <p className="finance-muted" role="status">
            Loading groups…
          </p>
        ) : error ? (
          <Empty
            title="Groups unavailable"
            description="Your saved groups could not be loaded."
            icon={<UsersRound size={20} />}
          />
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
              const id = idOf(group);
              return (
                <li key={id}>
                  <GroupCard
                    name={group.name ?? 'Group'}
                    icon={typeof group.icon === 'string' ? group.icon : undefined}
                    meta={`${group.currency ?? 'INR'} · shared ledger`}
                    balance="View balance"
                    meaning="Calculated from the complete group ledger"
                    onPress={() => router.push(`/group/${encodeURIComponent(id)}`)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
