import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import { CashFlowChart } from '../../analytics/web/CashFlowChart';
import { Meter } from '../../charts/web';
import { FinanceEmptyState } from '../../finance/web/FinanceEmptyState';
import type { HomeDashboardData } from '../model';

/** Cash flow beside "Category limits": the categories closest to their monthly limit. */
export function HomeFlowLimits({
  data,
  currency,
  onOpenCategory,
  onSeeAllCategories,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenCategory: (id: string) => void;
  onSeeAllCategories: () => void;
}) {
  return (
    <div className="finance-home-pair finance-home-flow-pair">
      <section className="finance-home-panel finance-home-flow-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">YEAR TO DATE</span>
            <h2>Cash flow</h2>
          </div>
          <a href="/analytics">
            Analytics <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <CashFlowChart buckets={data.cashFlow} currency={currency} />
      </section>
      <section className="finance-home-panel finance-home-budget-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">THIS MONTH</span>
            <h2>Category limits</h2>
          </div>
          <button type="button" onClick={onSeeAllCategories}>
            See all
          </button>
        </div>
        {data.categoryLimits.length ? (
          <div className="finance-home-budget-list">
            {data.categoryLimits.map((limit) => {
              const percent =
                limit.limitMinor > 0n ? Number((limit.spentMinor * 100n) / limit.limitMinor) : 0;
              return (
                <button
                  className="finance-home-budget"
                  key={limit.id}
                  type="button"
                  onClick={() => onOpenCategory(limit.id)}
                >
                  <span className="finance-home-budget-row">
                    <span>
                      {limit.icon ? `${limit.icon} ` : ''}
                      {limit.name}
                    </span>
                    <span>{Math.round(percent)}%</span>
                  </span>
                  <Meter
                    value={Number(limit.spentMinor)}
                    max={Number(limit.limitMinor)}
                    warnAt={limit.alertPercent / 100}
                    thin
                  />
                  <small>
                    {formatMinor(limit.spentMinor, limit.currency)} of{' '}
                    {formatMinor(limit.limitMinor, limit.currency)}
                  </small>
                </button>
              );
            })}
          </div>
        ) : (
          <FinanceEmptyState
            kind="budget"
            compact
            title="No category limits yet"
            description="Set a monthly limit on a category to track spending against it."
            action={<a href="/categories">Set a category limit</a>}
          />
        )}
      </section>
    </div>
  );
}
