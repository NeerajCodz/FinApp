'use client';

import { FilterOptionPopover } from '../../web/FilterOptionPopover';
export type ChartTypeOption = { value: string; label: string };

export function ChartTypeSelect({
  value,
  options,
  label,
  onChange,
}: {
  value: string;
  options: readonly ChartTypeOption[];
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterOptionPopover
      label={label}
      title={`${label} chart type`}
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
