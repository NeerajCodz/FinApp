'use client';

import React from 'react';
import { ArrowLeft, ChatCircle, UsersThree } from '@phosphor-icons/react';
import { PersonAvatar, Tile } from './GroupUI';
import { personStatus, type HubGroup, type HubPerson } from '../peopleHub';
import styles from './PeopleAnalytics.module.css';

type Kpi = { label: string; value: string; note?: string };

function KpiRow({ items }: { items: readonly Kpi[] }) {
  return (
    <section className={styles.kpis}>
      {items.map((item) => (
        <div key={item.label} className={styles.kpi}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <small>{item.note}</small> : null}
        </div>
      ))}
    </section>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  leading,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  leading?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} aria-label="Back" onClick={onBack}>
        <ArrowLeft size={18} />
      </button>
      {leading}
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}

type BarRow = { key: string; label: string; value: number; display?: string; tone?: string };

/** Horizontal share bars: label, bar, value. */
function ShareBars({ rows, empty }: { rows: readonly BarRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className={styles.muted}>{empty}</p>;
  return (
    <ul className={styles.bars}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className={styles.barLabel}>{row.label}</span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              data-tone={row.tone}
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
            />
          </span>
          <span className={styles.barValue}>{row.display ?? row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export type PeopleAnalyticsScreenProps = {
  people: readonly HubPerson[] | undefined;
  groups: readonly HubGroup[];
  owed: string;
  owing: string;
  onBack: () => void;
  onOpenPerson: (person: HubPerson) => void;
  onOpenGroup: (group: HubGroup) => void;
};

/** Analytics across your network: people, groups, unread and balances. */
export function PeopleAnalyticsScreen(p: PeopleAnalyticsScreenProps) {
  const people = p.people ?? [];
  const activeNow = people.filter((person) => person.active).length;
  const unread =
    people.reduce((sum, person) => sum + person.unreadCount, 0) +
    p.groups.reduce((sum, group) => sum + (group.unreadCount ?? 0), 0);
  const owedGroups = p.groups.filter((group) => group.balanceTone === 'positive');
  const owingGroups = p.groups.filter((group) => group.balanceTone === 'negative');
  return (
    <main className={styles.page}>
      <Header
        title="People analytics"
        subtitle="Your conversations, groups and shared balances."
        onBack={p.onBack}
      />
      <KpiRow
        items={[
          { label: 'People', value: String(people.length), note: `${activeNow} active now` },
          { label: 'Groups', value: String(p.groups.length), note: 'You belong to' },
          { label: 'Unread', value: String(unread), note: 'Across chats' },
          { label: 'You are owed', value: p.owed, note: `${owedGroups.length} groups` },
          { label: 'You owe', value: p.owing, note: `${owingGroups.length} groups` },
        ]}
      />
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Group balances</h2>
          <ul className={styles.list}>
            {[...owedGroups, ...owingGroups].map((group) => (
              <li key={group.id}>
                <button type="button" onClick={() => p.onOpenGroup(group)}>
                  <Tile icon={group.icon} color={group.color} />
                  <span className={styles.listCopy}>
                    <strong>{group.name}</strong>
                  </span>
                  <span className={styles.pill} data-tone={group.balanceTone}>
                    {group.balanceLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!owedGroups.length && !owingGroups.length ? (
            <p className={styles.muted}>You&apos;re settled up everywhere.</p>
          ) : null}
        </section>
        <section className={styles.panel}>
          <h2>Group sizes</h2>
          <ShareBars
            empty="No groups yet."
            rows={[...p.groups]
              .sort((a, b) => b.memberCount - a.memberCount)
              .slice(0, 8)
              .map((group) => ({
                key: group.id,
                label: group.name,
                value: group.memberCount,
                display: String(group.memberCount),
              }))}
          />
        </section>
      </div>
      <section className={styles.panel}>
        <h2>People</h2>
        {people.length ? (
          <ul className={styles.list}>
            {people.map((person) => (
              <li key={person.id}>
                <button type="button" onClick={() => p.onOpenPerson(person)}>
                  <PersonAvatar
                    name={person.displayName}
                    url={person.avatarUrl}
                    avatarId={person.avatarId}
                    size={36}
                  />
                  <span className={styles.listCopy}>
                    <strong>{person.displayName}</strong>
                    <small>
                      {personStatus(person) || (person.username ? `@${person.username}` : '')}
                    </small>
                  </span>
                  {person.unreadCount ? (
                    <span className={styles.pill}>{person.unreadCount} unread</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>{p.people === undefined ? 'Loading…' : 'No people yet.'}</p>
        )}
      </section>
    </main>
  );
}

export type PersonAnalyticsData = {
  profile: {
    displayName: string;
    username?: string;
    avatarId?: string;
    avatarUrl?: string | null;
  };
  friends: boolean;
  friendsSince: number | null;
  conversationSince: number | null;
  active: boolean | null;
  lastSeenAt: number | null;
  days: readonly { dayStart: number; sent: number; received: number }[];
  totalMessages: number;
  mix: { text: number; image: number; audio: number; ai: number };
  sharedGroups: readonly { id: string; name: string; icon?: string; color?: string }[];
};

export type PersonAnalyticsScreenProps = {
  data: PersonAnalyticsData | null | undefined;
  onBack: () => void;
  onMessage?: () => void;
  onOpenProfile?: () => void;
  onOpenGroup: (id: string) => void;
};

const shortDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** One person: 30-day message activity, message mix and shared groups. */
export function PersonAnalyticsScreen(p: PersonAnalyticsScreenProps) {
  if (p.data === undefined)
    return (
      <main className={styles.page} aria-busy="true">
        <p className={styles.muted}>Loading analytics…</p>
      </main>
    );
  if (p.data === null)
    return (
      <main className={styles.page}>
        <Header title="Analytics" subtitle="Not available" onBack={p.onBack} />
        <p className={styles.muted}>
          Analytics are available for people you&apos;re friends with, message, or share a group
          with.
        </p>
      </main>
    );
  const d = p.data;
  const sent = d.days.reduce((sum, day) => sum + day.sent, 0);
  const received = d.days.reduce((sum, day) => sum + day.received, 0);
  const activeDays = d.days.filter((day) => day.sent + day.received > 0).length;
  const busiest = d.days.reduce(
    (best, day) => (day.sent + day.received > best.sent + best.received ? day : best),
    { dayStart: 0, sent: 0, received: 0 },
  );
  const busiestCount = busiest.sent + busiest.received;
  const max = Math.max(1, ...d.days.map((day) => day.sent + day.received));
  const status = personStatus(d);
  const mixRows: BarRow[] = (
    [
      ['text', 'Text', d.mix.text],
      ['image', 'Photos', d.mix.image],
      ['audio', 'Voice', d.mix.audio],
      ['ai', 'FinAI', d.mix.ai],
    ] as const
  )
    .filter(([, , value]) => value > 0)
    .map(([key, label, value]) => ({
      key,
      label,
      value,
      display: `${Math.round((value / Math.max(1, d.totalMessages)) * 100)}%`,
    }));
  const since = d.friendsSince ?? d.conversationSince;
  return (
    <main className={styles.page}>
      <Header
        title={d.profile.displayName}
        subtitle={[d.profile.username ? `@${d.profile.username}` : '', status]
          .filter(Boolean)
          .join(' · ')}
        onBack={p.onBack}
        leading={
          <PersonAvatar
            name={d.profile.displayName}
            url={d.profile.avatarUrl}
            avatarId={d.profile.avatarId}
            size={48}
          />
        }
      />
      <div className={styles.actions}>
        {p.onMessage ? (
          <button type="button" className={styles.primary} onClick={p.onMessage}>
            <ChatCircle size={16} /> Message
          </button>
        ) : null}
        {p.onOpenProfile ? (
          <button type="button" className={styles.secondary} onClick={p.onOpenProfile}>
            View profile
          </button>
        ) : null}
      </div>
      <KpiRow
        items={[
          { label: 'Messages', value: String(d.totalMessages), note: 'Last 30 days' },
          { label: 'Sent / received', value: `${sent} / ${received}` },
          { label: 'Active days', value: String(activeDays), note: 'of 30' },
          {
            label: 'Busiest day',
            value: busiestCount ? shortDate(busiest.dayStart) : '—',
            note: busiestCount ? `${busiestCount} messages` : undefined,
          },
          {
            label: d.friends ? 'Friends since' : 'Chatting since',
            value: since ? shortDate(since) : '—',
          },
        ]}
      />
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Message activity</h2>
          <span className={styles.legend}>
            <i data-series="sent" /> You <i data-series="received" /> {d.profile.displayName}
          </span>
        </div>
        <div
          className={styles.columns}
          role="img"
          aria-label={`${d.totalMessages} messages in the last 30 days`}
        >
          {d.days.map((day) => (
            <span
              key={day.dayStart}
              className={styles.column}
              title={`${shortDate(day.dayStart)}: ${day.sent} sent, ${day.received} received`}
            >
              <span data-series="sent" style={{ height: `${(day.sent / max) * 100}%` }} />
              <span data-series="received" style={{ height: `${(day.received / max) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className={styles.axis}>
          <span>{d.days[0] ? shortDate(d.days[0].dayStart) : ''}</span>
          <span>Today</span>
        </div>
      </section>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Message mix</h2>
          <ShareBars empty="No messages in the last 30 days." rows={mixRows} />
        </section>
        <section className={styles.panel}>
          <h2>Shared groups</h2>
          {d.sharedGroups.length ? (
            <ul className={styles.list}>
              {d.sharedGroups.map((group) => (
                <li key={group.id}>
                  <button type="button" onClick={() => p.onOpenGroup(group.id)}>
                    <Tile icon={group.icon} color={group.color} />
                    <span className={styles.listCopy}>
                      <strong>{group.name}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>
              <UsersThree size={16} /> No shared groups.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
