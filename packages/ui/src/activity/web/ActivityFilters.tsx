'use client';

import { Card } from '@finapp/ui/web';

type Choice = { value: string; label: string };
type Option = { id: string; label: string };

export function ActivityFilters({
  periods,
  period,
  customRange,
  onPeriodChange,
  filters,
  filter,
  onFilterChange,
  accounts,
  account,
  onAccountChange,
  categories,
  category,
  onCategoryChange,
}: {
  periods: readonly Choice[];
  period: string;
  customRange: boolean;
  onPeriodChange: (value: string) => void;
  filters: readonly Choice[];
  filter: string;
  onFilterChange: (value: string) => void;
  accounts: readonly Option[];
  account: string;
  onAccountChange: (value: string) => void;
  categories: readonly Option[];
  category: string;
  onCategoryChange: (value: string) => void;
}) {
  return (
    <Card className="activity-toolbar">
      <div className="activity-period-switch" role="group" aria-label="Activity period">
        {periods.map((item) => {
          const active = period === item.value && !customRange;
          return <button key={item.value} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => onPeriodChange(item.value)}>{item.label}</button>;
        })}
      </div>
      <span className="activity-toolbar-divider" aria-hidden="true" />
      <div className="activity-type-switch" role="group" aria-label="Activity type filter">
        {filters.map((item) => {
          const active = filter === item.value;
          return <button key={item.value} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => onFilterChange(item.value)}>{item.label}</button>;
        })}
      </div>
      <div className="activity-selects">
        <label className="activity-visually-hidden" htmlFor="activity-account-filter">Filter by account</label>
        <select id="activity-account-filter" aria-label="Filter by account" value={account} onChange={(event) => onAccountChange(event.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <label className="activity-visually-hidden" htmlFor="activity-category-filter">Filter by category</label>
        <select id="activity-category-filter" aria-label="Filter by category" value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
    </Card>
  );
}
