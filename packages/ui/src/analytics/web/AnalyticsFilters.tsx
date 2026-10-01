'use client';

import { DateRangePopover } from '../../activity/web/DateRangePopover';
import styles from './Dashboard.module.css';

export type AnalyticsFilterOption = {
  value: string;
  label: string;
};

type AnalyticsFiltersProps = {
  periods: AnalyticsFilterOption[];
  period?: string;
  rangeLabel: string;
  rangeStartDate: string;
  rangeEndDate: string;
  onPeriodChange: (period: string) => void;
  onRangeApply: (startDate: string, endDate: string) => void;
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
  periods,
  period,
  rangeLabel,
  rangeStartDate,
  rangeEndDate,
  onPeriodChange,
  onRangeApply,
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
    <section className={styles.toolbar} aria-label="Analytics filters">
      <div className={styles.range}>
        <div className={styles.periods} aria-label="Period">
          {periods.map(option => <button key={option.value} type="button" className={styles.period} aria-pressed={period === option.value} onClick={() => onPeriodChange(option.value)}>{option.label}</button>)}
        </div>
        <DateRangePopover label={rangeLabel} startDate={rangeStartDate} endDate={rangeEndDate} presets={periods} onPresetSelect={onPeriodChange} onRangeApply={onRangeApply} />
        <div className={styles.periods} aria-label="Navigate periods">
          <button type="button" className={styles.period} aria-label="Previous period" disabled={!canNavigate} onClick={onPrevious}>‹</button>
          <button type="button" className={styles.period} aria-label="Next period" disabled={!canNavigate} onClick={onNext}>›</button>
          <button type="button" className={styles.period} onClick={onToday}>Today</button>
        </div>
      </div>
      <div className={styles.selects}>
        <select className={styles.select} aria-label="Account" value={account} onChange={event => onAccountChange(event.target.value)}>
          <option value="all">All accounts</option>{accounts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className={styles.select} aria-label="Category" value={category} onChange={event => onCategoryChange(event.target.value)}>
          <option value="all">All categories</option>{categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className={styles.select} aria-label="Type" value={type} onChange={event => onTypeChange(event.target.value)}>
          <option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option><option value="refund">Refunds</option><option value="adjustment">Adjustments</option>
        </select>
        <select className={styles.select} aria-label="Currency" value={currency} onChange={event => onCurrencyChange(event.target.value)}>
          {currencies.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
    </section>
  );
}
