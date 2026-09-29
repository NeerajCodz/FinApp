import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
import {
  allEmojiPickerOptions,
  emojiPickerCategories,
  getEmojiPickerCategoryId,
  getEmojiPickerOptions,
  type EmojiPickerOption,
} from '../emoji-picker-data';

export type EntityIconPickerMode = 'emoji' | 'lucide' | 'either';
type LucideIconComponent = React.ComponentType<LucideProps>;
type PickerKind = 'emoji' | 'lucide';

export type EntityIconPickerProps = {
  mode: EntityIconPickerMode;
  value?: string;
  onChange: (value?: string) => void;
  compact?: boolean;
  allowClear?: boolean;
  label?: string;
};

const lucideIcons = Object.entries(LucideIcons)
  .filter(
    ([name, icon]) =>
      /^[A-Z]/.test(name) &&
      name !== 'Icon' &&
      typeof icon === 'object' &&
      icon !== null &&
      '$$typeof' in icon,
  )
  .map(([name, icon]) => ({
    name,
    searchText: name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(),
    Icon: icon as unknown as LucideIconComponent,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const iconsByName: Record<string, LucideIconComponent> = {};
for (const { name, Icon } of lucideIcons) {
  iconsByName[name] = Icon;
  iconsByName[name.toLowerCase().replace(/[^a-z0-9]/g, '')] = Icon;
}

function componentFor(value: string): LucideIconComponent | undefined {
  const name = value.startsWith('lucide:') ? value.slice('lucide:'.length) : value;
  return iconsByName[name] ?? iconsByName[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
}

export function EntityIcon({
  value,
  size = 20,
  color,
}: {
  value?: string;
  size?: number;
  color?: string;
}) {
  const { tokens } = useTheme();
  if (!value) return null;
  const Icon = componentFor(value);
  if (Icon) return <Icon size={size} color={color ?? tokens.primary} />;
  if (value.startsWith('lucide:')) {
    const Fallback = iconsByName.CircleHelp;
    return Fallback ? <Fallback size={size} color={color ?? tokens.primary} /> : null;
  }
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{ maxWidth: size * 2, fontSize: size * 0.9, lineHeight: size, textAlign: 'center' }}
    >
      {value}
    </Text>
  );
}

function IconTile({
  icon,
  selected,
  onSelect,
}: {
  icon: (typeof lucideIcons)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const { tokens } = useTheme();
  const Icon = icon.Icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon.name}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={{
        width: '15%',
        aspectRatio: 1,
        borderWidth: 1,
        borderColor: selected ? tokens.primary : tokens.borderSubtle,
        borderRadius: 11,
        backgroundColor: selected ? tokens.surfaceSubtle : tokens.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={20} color={tokens.primary} />
    </Pressable>
  );
}

function EmojiTile({
  emoji,
  selected,
  onSelect,
}: {
  emoji: EmojiPickerOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${emoji.native} ${emoji.name}`}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={{
        width: '15%',
        aspectRatio: 1,
        borderWidth: 1,
        borderColor: selected ? tokens.primary : 'transparent',
        borderRadius: 11,
        backgroundColor: selected ? tokens.surfaceSubtle : tokens.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 24 }}>{emoji.native}</Text>
    </Pressable>
  );
}

export function EntityIconPicker({
  mode,
  value,
  onChange,
  compact = false,
  allowClear = false,
  label,
}: EntityIconPickerProps) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<PickerKind>(mode === 'emoji' ? 'emoji' : 'lucide');
  const [activeCategory, setActiveCategory] = useState('all');
  const [visibleIconCount, setVisibleIconCount] = useState(120);
  const triggerLabel = label ?? (value ? 'Change icon' : 'Choose icon');
  const selectedCategory = useMemo(() => getEmojiPickerCategoryId(value), [value]);
  const matchingEmojis = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const options = needle
      ? allEmojiPickerOptions
      : activeCategory === 'all'
        ? allEmojiPickerOptions
        : getEmojiPickerOptions(activeCategory);
    return needle
      ? options.filter(
          (emoji) => emoji.searchText.includes(needle) || emoji.native.includes(needle),
        )
      : options;
  }, [activeCategory, search]);
  const matchingIcons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? lucideIcons.filter((icon) => icon.searchText.includes(needle)) : lucideIcons;
  }, [search]);
  const displayedIcons = matchingIcons.slice(0, visibleIconCount);

  function openPicker() {
    if (mode === 'either') setKind(value?.startsWith('lucide:') ? 'lucide' : 'emoji');
    else setKind(mode);
    setActiveCategory(selectedCategory ?? 'all');
    setSearch('');
    setVisibleIconCount(120);
    setOpen(true);
  }

  function select(nextValue?: string) {
    onChange(nextValue);
    setOpen(false);
    setSearch('');
  }

  function changeKind(nextKind: PickerKind) {
    setKind(nextKind);
    setSearch('');
    setVisibleIconCount(120);
  }

  const renderEmoji = ({ item }: { item: EmojiPickerOption }) => (
    <EmojiTile emoji={item} selected={value === item.native} onSelect={() => select(item.native)} />
  );
  const renderIcon = ({ item }: { item: (typeof lucideIcons)[number] }) => (
    <IconTile
      icon={item}
      selected={value === `lucide:${item.name}`}
      onSelect={() => select(`lucide:${item.name}`)}
    />
  );

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
        onPress={openPicker}
        style={compact ? undefined : { alignSelf: 'flex-start', flexDirection: 'row', gap: 10 }}
      >
        {value ? (
          <EntityIcon value={value} size={22} color={tokens.primary} />
        ) : (
          <LucideIcons.Plus size={19} color={tokens.primary} />
        )}
        {!compact && (
          <Text>
            {label ??
              (value
                ? mode === 'emoji'
                  ? 'Change emoji'
                  : 'Change icon'
                : mode === 'emoji'
                  ? 'Choose emoji'
                  : 'Choose icon')}
          </Text>
        )}
      </Button>
      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setSearch('');
        }}
        title={
          mode === 'emoji'
            ? 'Choose an emoji'
            : mode === 'lucide'
              ? 'Choose an icon'
              : 'Choose an emoji or icon'
        }
      >
        <View style={{ maxHeight: 540, gap: 12 }}>
          {mode === 'either' && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['emoji', 'lucide'] as const).map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant={kind === choice ? 'secondary' : 'ghost'}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: kind === choice }}
                  onPress={() => changeKind(choice)}
                >
                  {choice === 'emoji' ? 'Emoji' : 'Lucide icons'}
                </Button>
              ))}
            </View>
          )}
          <Input
            accessibilityLabel={kind === 'emoji' ? 'Search emoji' : 'Search Lucide icons'}
            placeholder={kind === 'emoji' ? 'Search all emoji' : 'Search all Lucide icons'}
            value={search}
            onChangeText={(nextSearch) => {
              setSearch(nextSearch);
              setVisibleIconCount(120);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {kind === 'emoji' ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 4, paddingBottom: 2 }}
              >
                {emojiPickerCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="tab"
                    accessibilityLabel={category.label}
                    accessibilityState={{ selected: activeCategory === category.id }}
                    onPress={() => {
                      setActiveCategory(category.id);
                      setSearch('');
                    }}
                    style={{
                      minHeight: 34,
                      paddingHorizontal: 10,
                      borderRadius: 9,
                      backgroundColor:
                        activeCategory === category.id ? tokens.surfaceSubtle : 'transparent',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color:
                          activeCategory === category.id ? tokens.primary : tokens.foregroundMuted,
                      }}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {matchingEmojis.length ? (
                <FlatList
                  key={`emoji-${activeCategory}-${search ? 'search' : 'category'}`}
                  data={matchingEmojis}
                  keyExtractor={(item) => item.id}
                  renderItem={renderEmoji}
                  numColumns={6}
                  columnWrapperStyle={{ gap: 6 }}
                  contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 322, flexGrow: 0 }}
                />
              ) : (
                <Typography variant="small">No emoji match that search.</Typography>
              )}
            </>
          ) : (
            <>
              {displayedIcons.length ? (
                <FlatList
                  key={`lucide-${search}`}
                  data={displayedIcons}
                  keyExtractor={(item) => item.name}
                  renderItem={renderIcon}
                  numColumns={6}
                  columnWrapperStyle={{ gap: 6 }}
                  contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 340, flexGrow: 0 }}
                />
              ) : (
                <Typography variant="small">No Lucide icon matches that search.</Typography>
              )}
              {matchingIcons.length > displayedIcons.length && (
                <Button variant="ghost" onPress={() => setVisibleIconCount((count) => count + 120)}>
                  Show more icons ({matchingIcons.length - displayedIcons.length} remaining)
                </Button>
              )}
            </>
          )}
          {allowClear && !!value && (
            <Button variant="ghost" onPress={() => select(undefined)}>
              Use automatic icon
            </Button>
          )}
        </View>
      </Sheet>
    </>
  );
}
