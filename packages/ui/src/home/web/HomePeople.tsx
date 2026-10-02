import React from 'react';
import { ArrowUpRight, UsersRound } from 'lucide-react';
import { Avatar } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { FinanceEmptyState } from '../../finance/web/FinanceEmptyState';
import type { HomePerson } from '../types';

export function HomePeople({
  people,
  loading,
  error,
  currency,
  onOpenPerson,
}: {
  people: readonly HomePerson[];
  loading: boolean;
  error: boolean;
  currency: string;
  onOpenPerson: (username: string) => void;
}) {
  return (
    <section className="finance-home-panel finance-home-people-panel">
      <div className="finance-home-section-heading">
        <div>
          <span className="finance-eyebrow">SHARED FINANCES</span>
          <h2>People you transact with</h2>
        </div>
        <UsersRound size={18} aria-hidden="true" />
      </div>
      {loading ? (
        <p className="finance-home-empty">Loading shared activity…</p>
      ) : error ? (
        <p className="finance-home-empty" role="status">
          Shared activity couldn’t load. The rest of your dashboard is still available.
        </p>
      ) : people.length ? (
        <div className="finance-home-people-rail">
          {people.map((person) => (
            <button
              className="finance-home-person"
              key={person.id}
              type="button"
              disabled={!person.username}
              onClick={() => person.username && onOpenPerson(person.username)}
            >
              <Avatar
                initials={person.name.trim().slice(0, 1).toLocaleUpperCase() || 'F'}
                label={person.name}
                avatarId={person.avatarId}
                imageUrl={person.image}
                size={42}
              />
              <span className="finance-home-person-name">{person.name}</span>
              <small>{person.transactionCount} shared transactions</small>
              <strong>{formatMinor(person.amountMinor, currency)}</strong>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <FinanceEmptyState
          kind="group"
          compact
          title="No shared activity yet"
          description="Shared expenses with group members will appear here once you transact together."
        />
      )}
    </section>
  );
}
