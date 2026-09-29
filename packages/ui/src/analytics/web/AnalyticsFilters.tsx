'use client';

import { QuickFiltersPopover } from '../../web/QuickFiltersPopover';
import type { QuickFilterGroup } from '../../quickFilters';
import { DateRangePopover } from '../../activity/web/DateRangePopover';
import type { DateRangePreset } from '../../activity/dateRangeCalendar';

export type AnalyticsFilterOption = {
  value: string;
  label: string;
};

type AnalyticsFiltersProps = {
  periods: AnalyticsFilterOption[];
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
  const presets: DateRangePreset[] = periods;
  const groups: QuickFilterGroup[] = [
    {
      id: 'currency',
      label: 'Currency',
      options: currencies.map((value) => ({ value, label: value })),
      value: currency,
      onChange: onCurrencyChange,
    },
    {
      id: 'type',
      label: 'Type',
      options: [
        { value: 'all', label: 'All types' },
        { value: 'expense', label: 'Expenses' },
        { value: 'income', label: 'Income' },
        { value: 'transfer', label: 'Transfers' },
        { value: 'refund', label: 'Refunds' },
        { value: 'adjustment', label: 'Adjustments' },
      ],
      value: type,
      onChange: onTypeChange,
    },
    {
      id: 'account',
      label: 'Account',
      options: [
        { value: 'all', label: 'All accounts' },
        ...accounts.map((item) => ({ value: item.value, label: item.label })),
      ],
      value: account,
      onChange: onAccountChange,
    },
    {
      id: 'category',
      label: 'Category',
      options: [
        { value: 'all', label: 'All categories' },
        ...categories.map((item) => ({ value: item.value, label: item.label })),
      ],
      value: category,
      onChange: onCategoryChange,
    },
  ];
  return (
    <section className="analytics-toolbar" aria-label="Analytics filters">
      <div className="analytics-period-controls">
        <DateRangePopover
          label={rangeLabel}
          startDate={rangeStartDate}
          endDate={rangeEndDate}
          presets={presets}
          onPresetSelect={onPeriodChange}
          onRangeApply={onRangeApply}
        />
        <div className="analytics-date-controls">
          <button
            type="button"
            aria-label="Previous period"
            disabled={!canNavigate}
            onClick={onPrevious}
          >
            ‹
          </button>
          <button type="button" aria-label="Next period" disabled={!canNavigate} onClick={onNext}>
            ›
          </button>
          <button className="analytics-today-button" type="button" onClick={onToday}>
            Today
          </button>
        </div>
      </div>
      <QuickFiltersPopover groups={groups} />
    </section>
  );
}
