import { emojiPickerOptions } from './finance/emoji-picker-data';

export const categoryEmojiOptions = emojiPickerOptions.map(
  ({ native, searchText }) => [native, searchText] as const,
);
