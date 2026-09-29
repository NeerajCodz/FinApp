import emojiData from '@emoji-mart/data/sets/15/native.json';
import type { EmojiMartData } from '@emoji-mart/data';

const data = emojiData as unknown as EmojiMartData;

export type EmojiPickerOption = {
  id: string;
  name: string;
  native: string;
  keywords: string[];
  searchText: string;
};

const labels: Record<string, string> = {
  people: 'People',
  nature: 'Nature',
  foods: 'Food',
  activity: 'Activity',
  places: 'Travel & places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};

export const emojiPickerCategories = [
  { id: 'all', label: 'All' },
  ...data.categories.map(({ id }) => ({
    id,
    label:
      labels[id] ?? id.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  })),
];

const categoryByEmoji: Record<string, string> = Object.create(null);
const emojisByCategory: Record<string, string[]> = Object.create(null);
for (const category of data.categories) {
  emojisByCategory[category.id] = category.emojis;
  for (const id of category.emojis) categoryByEmoji[id] = category.id;
}

const skinToneLabels = [
  'default',
  'light skin tone',
  'medium-light skin tone',
  'medium skin tone',
  'medium-dark skin tone',
  'dark skin tone',
];
export const emojiPickerOptions: EmojiPickerOption[] = [];
const emojiByBaseId: Record<string, EmojiPickerOption[]> = Object.create(null);
const categoryByNative: Record<string, string> = Object.create(null);
for (const [id, emoji] of Object.entries(data.emojis)) {
  const categoryId = categoryByEmoji[id];
  const options = emoji.skins.map((skin, index) => {
    const tone = skinToneLabels[index] ?? `skin tone ${index}`;
    const name = index === 0 ? emoji.name : `${emoji.name} (${tone})`;
    return {
      id: index === 0 ? id : `${id}-${index}`,
      name,
      native: skin.native,
      keywords: emoji.keywords,
      searchText: `${name} ${emoji.keywords.join(' ')} ${id} ${tone}`.toLowerCase(),
    };
  });
  emojiByBaseId[id] = options;
  emojiPickerOptions.push(...options);
  if (categoryId) {
    for (const option of options) categoryByNative[option.native] = categoryId;
  }
}
export const allEmojiPickerOptions = emojiPickerOptions;

export function getEmojiPickerOptions(categoryId: string): EmojiPickerOption[] {
  const ids = emojisByCategory[categoryId];
  if (!ids) return emojiPickerOptions;
  return ids.flatMap((id) => emojiByBaseId[id] ?? []);
}

export function getEmojiPickerCategoryId(value?: string): string | undefined {
  return value ? categoryByNative[value] : undefined;
}
