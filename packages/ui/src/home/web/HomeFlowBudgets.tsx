import React from 'react';
import { ArrowUpRight, Target } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import { CashFlowChart } from '../../analytics/web/CashFlowChart';
import type { HomeDashboardData } from '../model';

export function HomeFlowBudgets({
  data,
  currency,
  onOpenBudget,
  onSeeAllBudgets,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenBudget: (id: string) => void;
  onSeeAllBudgets: () => void;
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
            <span className="finance-eyebrow">SPENDING LIMITS</span>
            <h2>Budgets</h2>
          </div>
          <button type="button" onClick={onSeeAllBudgets}>
            See all
          </button>
        </div>
        {data.budgets.length ? (
          <div className="finance-home-budget-list">
            {data.budgets.map((budget) => {
              const percent =
                budget.amountMinor > 0n
                  ? Math.min(100, Number((budget.spentMinor * 100n) / budget.amountMinor))
                  : 0;
              return (
                <button
                  className="finance-home-budget"
                  key={budget.id}
                  type="button"
                  onClick={() => onOpenBudget(budget.id)}
                >
                  <span className="finance-home-budget-row">
                    <span>{budget.name}</span>
                    <span>{Math.round(percent)}%</span>
                  </span>
                  <span className="finance-home-progress">
                    <span style={{ width: `${percent}%` }} />
                  </span>
                  <small>
                    {formatMinor(budget.spentMinor, budget.currency)} of{' '}
                    {formatMinor(budget.amountMinor, budget.currency)}
                  </small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="finance-home-empty-block">
            <Target size={21} aria-hidden="true" />
            <p>No active budgets for this period.</p>
            <a href="/budgets/new">Create a budget</a>
          </div>
        )}
      </section>
    </div>
  );
}
