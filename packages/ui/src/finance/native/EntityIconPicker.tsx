import React, { useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import * as PhosphorIcons from 'phosphor-react-native';
import type { IconProps as PhosphorProps } from 'phosphor-react-native';
import { FlatList, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
import {
  allEmojiPickerOptions,
  emojiPickerCategories,
  getEmojiPickerOptions,
  getPopularEmojiOptions,
  getRecentEmojiOptions,
  recordRecentEmoji,
  type EmojiPickerOption,
} from '../emoji-picker-data';
import { getIconPurpose, iconPurposeCategories, type IconPurpose } from '../icon-picker-data';

export type EntityIconPickerMode = 'emoji' | 'lucide' | 'phosphor' | 'either' | 'all';
type LucideIconComponent = React.ComponentType<LucideProps>;
type PhosphorIconComponent = React.ComponentType<PhosphorProps>;
type PickerKind = 'emoji' | 'lucide' | 'phosphor';

const emojiTabs = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
  ...emojiPickerCategories,
];

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
    purpose: getIconPurpose(name),
    Icon: icon as unknown as LucideIconComponent,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const phosphorIcons = Object.entries(PhosphorIcons)
  .filter(([name, icon]) => /^[A-Z]/.test(name) && typeof icon === 'function')
  .map(([name, icon]) => ({
    name,
    searchText: name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(),
    purpose: getIconPurpose(name),
    Icon: icon as unknown as PhosphorIconComponent,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const phosphorIconsByName: Record<string, PhosphorIconComponent> = {};
for (const { name, Icon } of phosphorIcons) {
  phosphorIconsByName[name] = Icon;
  phosphorIconsByName[name.toLowerCase().replace(/[^a-z0-9]/g, '')] = Icon;
}

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
  const Phosphor = value.startsWith('phosphor:')
    ? (phosphorIconsByName[value.slice('phosphor:'.length)] ??
      phosphorIconsByName[
        value
          .slice('phosphor:'.length)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      ])
    : undefined;
  if (Phosphor) return <Phosphor size={size} color={color ?? tokens.primary} weight="fill" />;
  const Icon = componentFor(value);
  if (Icon) return <Icon size={size} color={color ?? tokens.primary} />;
  if (value.startsWith('lucide:') || value.startsWith('phosphor:')) {
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
      accessibilityLabel={icon.searchText}
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
  selectedValue,
  onSelect,
}: {
  emoji: EmojiPickerOption;
  selectedValue?: string;
  onSelect: (value: string) => void;
}) {
  const { tokens } = useTheme();
  const triggerRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [tonesOpen, setTonesOpen] = useState(false);
  const [tonePosition, setTonePosition] = useState<{ top: number; left: number } | null>(null);
  const chosenTone = emoji.toneOptions.find((tone) => tone.native === selectedValue);
  const hasTones = emoji.toneOptions.length > 1;
  const chooseTone = (native: string) => {
    onSelect(native);
    setTonesOpen(false);
  };
  const toggleTones = () => {
    if (!hasTones) {
      chooseTone(emoji.native);
      return;
    }
    if (tonesOpen) {
      setTonesOpen(false);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const popupWidth = 208;
      const popupHeight = 44;
      setTonePosition({
        left: Math.max(8, Math.min(x + width / 2 - popupWidth / 2, windowWidth - popupWidth - 8)),
        top: Math.max(
          8,
          Math.min(
            y > popupHeight + 8 ? y - popupHeight - 5 : y + height + 5,
            windowHeight - popupHeight - 8,
          ),
        ),
      });
      setTonesOpen(true);
    });
  };

  return (
    <View style={{ width: '15%', aspectRatio: 1 }}>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`${emoji.name}${hasTones ? ', choose skin tone' : ''}`}
        accessibilityState={{ selected: !!chosenTone, expanded: hasTones ? tonesOpen : undefined }}
        onPress={toggleTones}
        style={{
          width: '100%',
          height: '100%',
          borderWidth: 1,
          borderColor: chosenTone ? tokens.primary : 'transparent',
          borderRadius: 11,
          backgroundColor: chosenTone ? tokens.surfaceSubtle : tokens.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 24 }}>{chosenTone?.native ?? emoji.native}</Text>
      </Pressable>
      <Modal
        visible={tonesOpen && !!tonePosition}
        transparent
        animationType="fade"
        onRequestClose={() => setTonesOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close skin tone picker"
            onPress={() => setTonesOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          {tonePosition && (
            <View
              accessibilityLabel={`${emoji.name} skin tone choices`}
              style={{
                position: 'absolute',
                top: tonePosition.top,
                left: tonePosition.left,
                flexDirection: 'row',
                gap: 3,
                padding: 5,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                borderRadius: 12,
                backgroundColor: tokens.popover,
                elevation: 20,
              }}
            >
              {emoji.toneOptions.map((tone) => (
                <Pressable
                  key={tone.id}
                  accessibilityRole="button"
                  accessibilityLabel={tone.toneLabel}
                  accessibilityState={{ selected: selectedValue === tone.native }}
                  onPress={() => chooseTone(tone.native)}
                  style={{
                    width: 30,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor:
                      selectedValue === tone.native ? tokens.primary : tokens.borderSubtle,
                    borderRadius: 8,
                    backgroundColor:
                      selectedValue === tone.native ? tokens.surfaceSubtle : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{tone.native}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
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
  const [kind, setKind] = useState<PickerKind>(
    mode === 'emoji' ? 'emoji' : mode === 'phosphor' ? 'phosphor' : 'lucide',
  );
  const [activeCategory, setActiveCategory] = useState('recent');
  const [activeIconPurpose, setActiveIconPurpose] = useState<IconPurpose>('finance');
  const [visibleIconCount, setVisibleIconCount] = useState(120);
  const triggerLabel = label ?? (value ? 'Change icon' : 'Choose icon');
  const matchingEmojis = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const recent = getRecentEmojiOptions();
    const options = needle
      ? allEmojiPickerOptions
      : activeCategory === 'recent'
        ? recent.length
          ? recent
          : getPopularEmojiOptions()
        : activeCategory === 'popular'
          ? getPopularEmojiOptions()
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
    return lucideIcons.filter((icon) =>
      needle
        ? icon.searchText.includes(needle)
        : activeIconPurpose === 'all' || icon.purpose === activeIconPurpose,
    );
  }, [activeIconPurpose, search]);
  const matchingPhosphorIcons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return phosphorIcons.filter((icon) =>
      needle
        ? icon.searchText.includes(needle)
        : activeIconPurpose === 'all' || icon.purpose === activeIconPurpose,
    );
  }, [activeIconPurpose, search]);
  const displayedIcons = matchingIcons.slice(0, visibleIconCount);
  const displayedPhosphorIcons = matchingPhosphorIcons.slice(0, visibleIconCount);

  function openPicker() {
    if (mode === 'either' || mode === 'all') {
      setKind(
        value?.startsWith('phosphor:')
          ? 'phosphor'
          : value?.startsWith('lucide:')
            ? 'lucide'
            : 'emoji',
      );
    } else setKind(mode);
    setActiveCategory(getRecentEmojiOptions().length ? 'recent' : 'popular');
    setActiveIconPurpose('finance');
    setVisibleIconCount(120);
    setOpen(true);
  }

  function select(nextValue?: string) {
    if (nextValue && !nextValue.startsWith('lucide:') && !nextValue.startsWith('phosphor:')) {
      recordRecentEmoji(nextValue);
    }
    onChange(nextValue);
    setOpen(false);
    setSearch('');
  }

  function changeKind(nextKind: PickerKind) {
    setKind(nextKind);
    setSearch('');
    setVisibleIconCount(120);
    setActiveCategory(getRecentEmojiOptions().length ? 'recent' : 'popular');
    setActiveIconPurpose('finance');
  }

  const renderEmoji = ({ item }: { item: EmojiPickerOption }) => (
    <EmojiTile emoji={item} selectedValue={value} onSelect={select} />
  );
  const renderIcon = ({ item }: { item: (typeof lucideIcons)[number] }) => (
    <IconTile
      icon={item}
      selected={value === `lucide:${item.name}`}
      onSelect={() => select(`lucide:${item.name}`)}
    />
  );
  const renderPhosphorIcon = ({ item }: { item: (typeof phosphorIcons)[number] }) => {
    const Icon = item.Icon;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.searchText}
        accessibilityState={{ selected: value === `phosphor:${item.name}` }}
        onPress={() => select(`phosphor:${item.name}`)}
        style={{
          width: '15%',
          aspectRatio: 1,
          borderWidth: 1,
          borderColor: value === `phosphor:${item.name}` ? tokens.primary : tokens.borderSubtle,
          borderRadius: 11,
          backgroundColor:
            value === `phosphor:${item.name}` ? tokens.surfaceSubtle : tokens.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={tokens.primary} weight="fill" />
      </Pressable>
    );
  };

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
        ) : mode === 'phosphor' ? (
          <PhosphorIcons.Plus size={19} color={tokens.primary} weight="fill" />
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
            : mode === 'phosphor'
              ? 'Choose a Phosphor icon'
              : mode === 'lucide'
                ? 'Choose a Lucide icon'
                : 'Choose an emoji or icon'
        }
      >
        <View style={{ maxHeight: 540, gap: 12 }}>
          {(mode === 'either' || mode === 'all') && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(mode === 'all'
                ? (['emoji', 'lucide', 'phosphor'] as const)
                : (['emoji', 'lucide'] as const)
              ).map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant={kind === choice ? 'secondary' : 'ghost'}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: kind === choice }}
                  onPress={() => changeKind(choice)}
                >
                  {choice === 'emoji'
                    ? 'Emoji'
                    : `${choice[0]!.toUpperCase()}${choice.slice(1)} icons`}
                </Button>
              ))}
            </View>
          )}
          <Input
            accessibilityLabel={kind === 'emoji' ? 'Search emoji' : `Search ${kind} icons`}
            placeholder={kind === 'emoji' ? 'Search all emoji' : `Search all ${kind} icons`}
            value={search}
            onChangeText={(nextSearch) => {
              setSearch(nextSearch);
              setVisibleIconCount(120);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {kind !== 'emoji' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 4, paddingBottom: 2 }}
            >
              {iconPurposeCategories.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="tab"
                  accessibilityLabel={category.label}
                  accessibilityState={{ selected: activeIconPurpose === category.id }}
                  onPress={() => {
                    setActiveIconPurpose(category.id);
                    setSearch('');
                    setVisibleIconCount(120);
                  }}
                  style={{
                    minHeight: 34,
                    paddingHorizontal: 10,
                    borderRadius: 9,
                    backgroundColor:
                      activeIconPurpose === category.id ? tokens.surfaceSubtle : 'transparent',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color:
                        activeIconPurpose === category.id ? tokens.primary : tokens.foregroundMuted,
                    }}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {kind === 'emoji' ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 4, paddingBottom: 2 }}
              >
                {emojiTabs.map((category) => (
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
          ) : kind === 'lucide' ? (
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
          ) : (
            <>
              {displayedPhosphorIcons.length ? (
                <FlatList
                  key={`phosphor-${search}`}
                  data={displayedPhosphorIcons}
                  keyExtractor={(item) => item.name}
                  renderItem={renderPhosphorIcon}
                  numColumns={6}
                  columnWrapperStyle={{ gap: 6 }}
                  contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 340, flexGrow: 0 }}
                />
              ) : (
                <Typography variant="small">No Phosphor icon matches that search.</Typography>
              )}
              {matchingPhosphorIcons.length > displayedPhosphorIcons.length && (
                <Button variant="ghost" onPress={() => setVisibleIconCount((count) => count + 120)}>
                  Show more icons ({matchingPhosphorIcons.length - displayedPhosphorIcons.length}{' '}
                  remaining)
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
