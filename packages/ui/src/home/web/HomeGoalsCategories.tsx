import React from 'react';
import { ArrowUpRight, PiggyBank } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import type { HomeDashboardData } from '../model';

export function HomeGoalsCategories({
  data,
  currency,
  onOpenGoal,
  onSeeAllGoals,
  onOpenCategory,
  onSeeAllCategories,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenGoal: (id: string) => void;
  onSeeAllGoals: () => void;
  onOpenCategory: (id: string) => void;
  onSeeAllCategories: () => void;
}) {
  const maxCategory = data.categories.reduce(
    (maximum, category) => Math.max(maximum, Number(category.amountMinor)),
    0,
  );
  return (
    <div className="finance-home-pair finance-home-goals-pair">
      <section className="finance-home-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">BUILDING TOWARD</span>
            <h2>Savings &amp; goals</h2>
          </div>
          <button type="button" onClick={onSeeAllGoals}>
            See all
          </button>
        </div>
        {data.goals.length ? (
          <div className="finance-home-goal-list">
            {data.goals.map((goal) => {
              const progress =
                goal.targetMinor > 0n
                  ? Math.min(100, Number((goal.savedMinor * 100n) / goal.targetMinor))
                  : 0;
              return (
                <button
                  className="finance-home-goal"
                  key={goal.id}
                  type="button"
                  onClick={() => onOpenGoal(goal.id)}
                >
                  <span className="finance-home-goal-icon">
                    <PiggyBank size={17} aria-hidden="true" />
                  </span>
                  <span className="finance-home-goal-main">
                    <span className="finance-home-budget-row">
                      <strong>{goal.name}</strong>
                      <small>{Math.round(progress)}%</small>
                    </span>
                    <span className="finance-home-progress">
                      <span style={{ width: `${progress}%` }} />
                    </span>
                    <small>
                      {formatMinor(goal.savedMinor, goal.currency || currency)} of{' '}
                      {formatMinor(goal.targetMinor, goal.currency || currency)}
                    </small>
                  </span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="finance-home-empty-block">
            <PiggyBank size={21} aria-hidden="true" />
            <p>No active savings goals yet.</p>
            <a href="/goals">Create a goal</a>
          </div>
        )}
      </section>
      <section className="finance-home-panel">
        <div className="finance-home-section-heading">
          <div>
            <span className="finance-eyebrow">THIS PERIOD</span>
            <h2>Spend by category</h2>
          </div>
          <button type="button" onClick={onSeeAllCategories}>
            See all
          </button>
        </div>
        {data.categories.length ? (
          <div className="finance-home-category-list">
            {data.categories.map((category) => {
              const percent = maxCategory ? (Number(category.amountMinor) / maxCategory) * 100 : 0;
              return (
                <button
                  className="finance-home-category"
                  key={category.id}
                  type="button"
                  onClick={() => onOpenCategory(category.id)}
                >
                  <span className="finance-home-category-icon">{category.icon || '•'}</span>
                  <span className="finance-home-category-main">
                    <span className="finance-home-budget-row">
                      <strong>{category.name}</strong>
                      <strong>{formatMinor(category.amountMinor, currency)}</strong>
                    </span>
                    <span className="finance-home-progress">
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="finance-home-empty-block">
            <span aria-hidden="true">◌</span>
            <p>No spending recorded in this period.</p>
            <a href="/category">Browse categories</a>
          </div>
        )}
      </section>
    </div>
  );
}
