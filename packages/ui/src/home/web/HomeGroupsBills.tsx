import React from 'react';
import { ArrowUpRight, CalendarClock, UsersRound } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import type { HomeDashboardData } from '../model';
import { FinanceEmptyState } from '../../finance/web/FinanceEmptyState';

export function HomeGroupsBills({
  data,
  currency,
  onOpenGroup,
  onSeeAllGroups,
  onSeeAllBills,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenGroup: (id: string) => void;
  onSeeAllGroups: () => void;
  onSeeAllBills: () => void;
}) {
  return (
    <div className="finance-home-pair finance-home-groups-pair">
      <section className="finance-home-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">SHARED WITH OTHERS</span>
            <h2>Groups</h2>
          </div>
          <button type="button" onClick={onSeeAllGroups}>
            See all
          </button>
        </div>
        {data.groups.length ? (
          <div className="finance-home-group-list">
            {data.groups.map((group) => (
              <button
                className="finance-home-group"
                key={group.id}
                type="button"
                onClick={() => onOpenGroup(group.id)}
              >
                <span className="finance-home-group-icon">
                  <UsersRound size={17} aria-hidden="true" />
                </span>
                <span className="finance-home-group-main">
                  <strong>{group.name}</strong>
                  <small>
                    {group.memberCount} members ·{' '}
                    {formatMinor(group.spentMinor, group.currency || currency)} spent
                  </small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <FinanceEmptyState
            kind="group"
            compact
            title="No shared groups yet"
            description="Share expenses and keep track of balances together."
            action={<a href="/groups">Create a group</a>}
          />
        )}
      </section>
      <section className="finance-home-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">NEXT 30 DAYS</span>
            <h2>Recurring &amp; bills</h2>
          </div>
          <button type="button" onClick={onSeeAllBills}>
            See all
          </button>
        </div>
        {data.upcomingBills.length ? (
          <div className="finance-home-bill-list">
            {data.upcomingBills.map((bill) => (
              <div className="finance-home-bill" key={bill.id}>
                <span className="finance-home-bill-icon">
                  <CalendarClock size={17} aria-hidden="true" />
                </span>
                <span>
                  <strong>{bill.name}</strong>
                  <small>
                    {new Date(bill.nextOccurrence).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
                <strong>{formatMinor(bill.amountMinor, bill.currency || currency)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <FinanceEmptyState
            kind="recurring"
            compact
            title="No bills due in the next 30 days"
            description="Upcoming recurring payments will appear here."
            action={<a href="/recurring">Manage recurring</a>}
          />
        )}
      </section>
    </div>
  );
}
