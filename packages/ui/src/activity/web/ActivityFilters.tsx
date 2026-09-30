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
    { id: 'type', label: 'Type', options: filters, value: filter, onChange: onFilterChange },
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
