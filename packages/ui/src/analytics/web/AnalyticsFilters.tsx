'use client';

 
export type AnalyticsFilterOption = {
  value: string;
  label: string;
};

type AnalyticsFiltersProps = {
  period: string;
  periods: AnalyticsFilterOption[];
  onPeriodChange: (period: string) => void;
  rangeLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  canNavigate: boolean;
  currency: string;
  currencies: string[];
  onCurrencyChange: (currency: string) => void;
  account: string;
  accounts: AnalyticsFilterOption[];
  onAccountChange: (account: string) => void;
  category: string;
  categories: AnalyticsFilterOption[];
  onCategoryChange: (category: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
};

export function AnalyticsFilters({
  period,
  periods,
  onPeriodChange,
  rangeLabel,
  onPrevious,
  onNext,
  onToday,
  canNavigate,
  currency,
  currencies,
  onCurrencyChange,
  account,
  accounts,
  onAccountChange,
  category,
  categories,
  onCategoryChange,
  type,
  onTypeChange,
}: AnalyticsFiltersProps) {
  return (
    <section className="analytics-toolbar" aria-label="Analytics filters">
      <div className="analytics-period-controls">
        <div className="analytics-period-switch" role="group" aria-label="Analytics period">
          {periods.map((item) => (
            <button key={item.value} type="button" aria-pressed={period === item.value} onClick={() => onPeriodChange(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="analytics-date-controls">
          <button type="button" aria-label="Previous period" disabled={!canNavigate} onClick={onPrevious}>‹</button>
          <span>{rangeLabel}</span>
          <button type="button" aria-label="Next period" disabled={!canNavigate} onClick={onNext}>›</button>
          <button className="analytics-today-button" type="button" onClick={onToday}>Today</button>
        </div>
      </div>
      <div className="analytics-select-controls">
        <label><span className="activity-visually-hidden">Currency</span><select aria-label="Filter by currency" value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
        <label><span className="activity-visually-hidden">Account</span><select aria-label="Filter by account" value={account} onChange={(event) => onAccountChange(event.target.value)}><option value="all">All accounts</option>{accounts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="activity-visually-hidden">Category</span><select aria-label="Filter by category" value={category} onChange={(event) => onCategoryChange(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="activity-visually-hidden">Transaction type</span><select aria-label="Filter by transaction type" value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option><option value="refund">Refunds</option><option value="adjustment">Adjustments</option></select></label>
      </div>
    </section>
  );
}
