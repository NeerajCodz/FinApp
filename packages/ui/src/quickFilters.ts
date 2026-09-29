export type QuickFilterOption = { value: string; label: string };
export type QuickFilterGroup = {
  id: string;
  label: string;
  options: readonly QuickFilterOption[];
  value: string;
  onChange: (value: string) => void;
};
