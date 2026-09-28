'use client';

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
    <label className="analytics-chart-type">
      <span>Chart</span>
      <select className="analytics-chart-select" aria-label={`${label} chart type`} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
