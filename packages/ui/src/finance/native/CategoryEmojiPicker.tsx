import { EntityIconPicker } from './EntityIconPicker';

export function CategoryEmojiPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: string;
  onChange: (emoji?: string) => void;
  compact?: boolean;
}) {
  return (
    <EntityIconPicker
      mode="emoji"
      value={value}
      onChange={onChange}
      compact={compact}
      allowClear
      label={value ? 'Change category emoji' : 'Choose category emoji'}
    />
  );
}
