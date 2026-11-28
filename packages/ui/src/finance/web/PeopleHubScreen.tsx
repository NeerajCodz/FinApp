'use client';

import React from 'react';
import { CaretRight, ChartBar, MagnifyingGlass } from '@phosphor-icons/react';
import { PersonAvatar, Tile } from './GroupUI';
import { FinanceEmptyState } from './FinanceEmptyState';
import {
  matchesHubSearch,
  personStatus,
  unreadBadge,
  type HubGroup,
  type HubPerson,
} from '../peopleHub';
import styles from './PeopleHub.module.css';

export type PeopleHubScreenProps = {
  people: readonly HubPerson[] | undefined;
  peopleTruncated?: boolean;
  groups: readonly HubGroup[] | undefined;
  onOpenAnalytics: () => void;
  onOpenPeople: () => void;
  onOpenGroups: () => void;
  onOpenPerson: (person: HubPerson) => void;
  onOpenPersonAnalytics: (person: HubPerson) => void;
  onOpenGroup: (group: HubGroup) => void;
  onOpenGroupAnalytics: (group: HubGroup) => void;
};

/** People hub: search, a horizontal row of people, then your groups. */
export function PeopleHubScreen(p: PeopleHubScreenProps) {
  const [query, setQuery] = React.useState('');
  const people = (p.people ?? []).filter((person) => matchesHubSearch(person, query));
  const groups = (p.groups ?? []).filter((group) => matchesHubSearch(group, query));
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>YOUR NETWORK</span>
          <h1>People</h1>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="People analytics"
          title="People analytics"
          onClick={p.onOpenAnalytics}
        >
          <ChartBar size={20} />
        </button>
      </header>

      <label className={styles.search}>
        <MagnifyingGlass size={18} aria-hidden />
        <span className="finance-sr-only">Search people and groups</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search people and groups"
          aria-label="Search people and groups"
        />
      </label>

      <section aria-labelledby="hub-people">
        <button type="button" className={styles.sectionTitle} onClick={p.onOpenPeople}>
          <h2 id="hub-people">People</h2>
          <CaretRight size={16} aria-hidden />
        </button>
        {p.people === undefined ? (
          <div className={styles.row} aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`${styles.personCard} ${styles.skeleton}`} />
            ))}
          </div>
        ) : people.length ? (
          <div className={styles.row} role="list">
            {people.map((person) => {
              const badge = unreadBadge(person.unreadCount, person.unreadCapped);
              const status = personStatus(person);
              return (
                <div key={person.id} role="listitem" className={styles.personCard}>
                  <button
                    type="button"
                    className={styles.cardAnalytics}
                    aria-label={`${person.displayName} analytics`}
                    onClick={() => p.onOpenPersonAnalytics(person)}
                  >
                    <ChartBar size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.personMain}
                    aria-label={`${person.displayName}${badge ? `, ${badge} new messages` : ''}`}
                    onClick={() => p.onOpenPerson(person)}
                  >
                    <span className={styles.avatarWrap}>
                      <PersonAvatar
                        name={person.displayName}
                        url={person.avatarUrl}
                        avatarId={person.avatarId}
                        size={56}
                      />
                      {person.active ? <span className={styles.activeDot} aria-hidden /> : null}
                      {badge ? <span className={styles.badge}>{badge}</span> : null}
                    </span>
                    <strong>{person.displayName}</strong>
                    <small>{status || (person.username ? `@${person.username}` : ' ')}</small>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>
            {query ? 'No people match your search.' : 'Add friends to see them here.'}
          </p>
        )}
        {p.peopleTruncated ? (
          <p className={styles.empty}>Showing a limited set of people; some contacts may be omitted.</p>
        ) : null}
      </section>

      <section aria-labelledby="hub-groups">
        <button type="button" className={styles.sectionTitle} onClick={p.onOpenGroups}>
          <h2 id="hub-groups">Groups</h2>
          <CaretRight size={16} aria-hidden />
        </button>
        {p.groups === undefined ? (
          <div className={styles.groups} aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className={`${styles.groupCard} ${styles.skeleton}`} />
            ))}
          </div>
        ) : groups.length ? (
          <div className={styles.groups} role="list">
            {groups.map((group) => {
              const badge = unreadBadge(group.unreadCount, group.unreadCapped);
              return (
                <div key={group.id} role="listitem" className={styles.groupCard}>
                  <button
                    type="button"
                    className={styles.groupMain}
                    onClick={() => p.onOpenGroup(group)}
                    aria-label={`${group.name}${badge ? `, ${badge} new messages` : ''}`}
                  >
                    <span className={styles.avatarWrap}>
                      <Tile icon={group.icon} color={group.color} />
                      {badge ? <span className={styles.badge}>{badge}</span> : null}
                    </span>
                    <span className={styles.groupCopy}>
                      <strong>{group.name}</strong>
                      <small>
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        {group.balanceLabel ? (
                          <>
                            {' · '}
                            <span data-tone={group.balanceTone}>{group.balanceLabel}</span>
                          </>
                        ) : null}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.cardAnalytics}
                    aria-label={`${group.name} analytics`}
                    onClick={() => p.onOpenGroupAnalytics(group)}
                  >
                    <ChartBar size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : query ? (
          <p className={styles.empty}>No groups match your search.</p>
        ) : (
          <FinanceEmptyState
            kind="group"
            title="No groups yet"
            description="Create a group to split trips, rent or dinners."
          />
        )}
      </section>
    </main>
  );
}
