'use client';

import { Card } from '@finapp/ui/web';
import { QuickFiltersPopover } from '../../web/QuickFiltersPopover';
import type { QuickFilterGroup } from '../../quickFilters';
import { DateRangePopover } from './DateRangePopover';
import type { DateRangePreset } from '../dateRangeCalendar';

type Choice = { value: string; label: string };
type Option = { id: string; label: string };
export function ActivityFilters({
  rangeLabel,
  rangeStartDate,
  rangeEndDate,
  presets,
  period,
  onPresetSelect,
  onRangeApply,
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
  rangeLabel: string;
  rangeStartDate: string;
  rangeEndDate: string;
  presets: readonly DateRangePreset[];
  period?: string;
  onPresetSelect: (value: string) => void;
  onRangeApply: (startDate: string, endDate: string) => void;
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
  const groups: QuickFilterGroup[] = [
    {
      id: 'account',
      label: 'Account',
      options: [
        { value: 'all', label: 'All accounts' },
        ...accounts.map(({ id, label }) => ({ value: id, label })),
      ],
      value: account,
      onChange: onAccountChange,
    },
    {
      id: 'category',
      label: 'Category',
      options: [
        { value: 'all', label: 'All categories' },
        ...categories.map(({ id, label }) => ({ value: id, label })),
      ],
      value: category,
      onChange: onCategoryChange,
    },
  ];
  return (
    <Card className="activity-toolbar" aria-label="Activity filters">
      <div className="activity-period-switch" aria-label="Period">
        <span>Period</span>
        {presets
          .filter((preset) => preset.value.startsWith('period:'))
          .map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={period === preset.value ? 'active' : undefined}
              aria-pressed={period === preset.value}
              onClick={() => onPresetSelect(preset.value)}
            >
              {preset.label}
            </button>
          ))}
      </div>
      <div className="activity-type-switch" aria-label="Transaction type">
        <span>Type</span>
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            className={filter === option.value ? 'active' : undefined}
            aria-pressed={filter === option.value}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <QuickFiltersPopover groups={groups} />
      <DateRangePopover
        label={rangeLabel}
        startDate={rangeStartDate}
        endDate={rangeEndDate}
        presets={presets}
        onPresetSelect={onPresetSelect}
        onRangeApply={onRangeApply}
      />
    </Card>
  );
}
