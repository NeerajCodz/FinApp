import emojiData from '@emoji-mart/data/sets/15/native.json';
import type { EmojiMartData } from '@emoji-mart/data';

const data = emojiData as unknown as EmojiMartData;

export type EmojiToneOption = {
  id: string;
  name: string;
  native: string;
  toneLabel: string;
};

export type EmojiPickerOption = {
  id: string;
  name: string;
  native: string;
  keywords: string[];
  searchText: string;
  toneOptions: EmojiToneOption[];
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
  'Default skin tone',
  'Light skin tone',
  'Medium-light skin tone',
  'Medium skin tone',
  'Medium-dark skin tone',
  'Dark skin tone',
];
export const emojiPickerOptions: EmojiPickerOption[] = [];
const emojiByBaseId: Record<string, EmojiPickerOption[]> = Object.create(null);
const categoryByNative: Record<string, string> = Object.create(null);
const emojiByNative = new Map<string, EmojiPickerOption>();
for (const [id, emoji] of Object.entries(data.emojis)) {
  const categoryId = categoryByEmoji[id];
  const toneOptions = emoji.skins.map((skin, index) => {
    const toneLabel = skinToneLabels[index] ?? `Skin tone ${index}`;
    return {
      id: index === 0 ? id : `${id}-${index}`,
      name: index === 0 ? emoji.name : `${emoji.name} (${toneLabel})`,
      native: skin.native,
      toneLabel,
    };
  });
  const option: EmojiPickerOption = {
    id,
    name: emoji.name,
    native: toneOptions[0]?.native ?? '',
    keywords: emoji.keywords,
    searchText:
      `${emoji.name} ${emoji.keywords.join(' ')} ${id} ${toneOptions.map(({ toneLabel }) => toneLabel).join(' ')}`.toLowerCase(),
    toneOptions,
  };
  emojiByBaseId[id] = [option];
  emojiPickerOptions.push(option);
  for (const tone of toneOptions) {
    emojiByNative.set(tone.native, option);
    if (categoryId) categoryByNative[tone.native] = categoryId;
  }
}
export const allEmojiPickerOptions = emojiPickerOptions;

const popularEmojiIds = [
  'money_with_wings',
  'moneybag',
  'credit_card',
  'shopping_cart',
  'receipt',
  'hamburger',
  'coffee',
  'house',
  'car',
  'airplane',
  'gift',
  'tada',
  'books',
  'pill',
  'dog',
  'bulb',
  'iphone',
  'musical_note',
  'weight_lifting',
  'seedling',
  'luggage',
  'green_salad',
];
const recentEmojiValues: string[] = [];

export function getRecentEmojiOptions(): EmojiPickerOption[] {
  const seen = new Set<string>();
  return recentEmojiValues.flatMap((value) => {
    const option = emojiByNative.get(value);
    if (!option || seen.has(option.id)) return [];
    seen.add(option.id);
    return [option];
  });
}

export function getPopularEmojiOptions(): EmojiPickerOption[] {
  return popularEmojiIds.flatMap((id) => (emojiByBaseId[id]?.[0] ? [emojiByBaseId[id][0]] : []));
}

export function recordRecentEmoji(value: string): void {
  if (!emojiByNative.has(value)) return;
  recentEmojiValues.splice(
    0,
    recentEmojiValues.length,
    value,
    ...recentEmojiValues.filter((item) => item !== value).slice(0, 23),
  );
}

export function getEmojiPickerOptions(categoryId: string): EmojiPickerOption[] {
  const ids = emojisByCategory[categoryId];
  if (!ids) return emojiPickerOptions;
  return ids.flatMap((id) => emojiByBaseId[id] ?? []);
}

export function getEmojiPickerCategoryId(value?: string): string | undefined {
  return value ? categoryByNative[value] : undefined;
}
