'use client';

import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/web';
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

export type EntityIconPickerMode = 'emoji' | 'lucide' | 'either';
type LucideIconComponent = React.ComponentType<LucideProps>;
type PickerKind = 'emoji' | 'lucide';

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
  if (Icon) return <Icon size={size} color={color ?? tokens.primary} aria-hidden="true" />;
  if (value.startsWith('lucide:')) {
    const Fallback = iconsByName.CircleHelp;
    return Fallback ? (
      <Fallback size={size} color={color ?? tokens.primary} aria-hidden="true" />
    ) : null;
  }
  return (
    <span
      title={value}
      style={{
        maxWidth: size * 2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: size * 0.9,
        lineHeight: 1,
      }}
    >
      {value}
    </span>
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
    <button
      type="button"
      aria-label={icon.searchText}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        minWidth: 0,
        minHeight: 46,
        aspectRatio: '1',
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${selected ? tokens.primary : tokens.borderSubtle}`,
        borderRadius: 11,
        background: selected ? tokens.surfaceSubtle : tokens.surfaceRaised,
        color: tokens.primary,
        cursor: 'pointer',
      }}
    >
      <Icon size={20} color={tokens.primary} aria-hidden="true" />
    </button>
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
    <button
      type="button"
      aria-label={`${emoji.native} ${emoji.name}`}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        minWidth: 0,
        aspectRatio: '1',
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${selected ? tokens.primary : 'transparent'}`,
        borderRadius: 11,
        background: selected ? tokens.surfaceSubtle : tokens.surfaceRaised,
        cursor: 'pointer',
        fontSize: 24,
      }}
    >
      {emoji.native}
    </button>
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
  const displayedIcons = matchingIcons.slice(0, visibleIconCount);

  function openPicker() {
    if (mode === 'either') setKind(value?.startsWith('lucide:') ? 'lucide' : 'emoji');
    else setKind(mode);
    setActiveCategory(getRecentEmojiOptions().length ? 'recent' : 'popular');
    setActiveIconPurpose('finance');
    setVisibleIconCount(120);
    setOpen(true);
  }

  function select(nextValue?: string) {
    if (nextValue && !nextValue.startsWith('lucide:')) recordRecentEmoji(nextValue);
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

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
        onPress={openPicker}
        style={compact ? undefined : { alignSelf: 'flex-start', gap: 10 }}
      >
        {value ? (
          <EntityIcon value={value} size={22} color={tokens.primary} />
        ) : (
          <LucideIcons.Plus size={19} color={tokens.primary} aria-hidden="true" />
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
        {mode === 'either' && (
          <div role="tablist" aria-label="Icon type" style={{ display: 'flex', gap: 6 }}>
            {(['emoji', 'lucide'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                role="tab"
                aria-selected={kind === choice}
                onClick={() => changeKind(choice)}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  border: `1px solid ${kind === choice ? tokens.primary : tokens.borderSubtle}`,
                  borderRadius: 10,
                  background: kind === choice ? tokens.surfaceSubtle : 'transparent',
                  color: tokens.foreground,
                  cursor: 'pointer',
                }}
              >
                {choice === 'emoji' ? 'Emoji' : 'Lucide icons'}
              </button>
            ))}
          </div>
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
          autoCorrect="off"
        />
        {kind === 'lucide' && (
          <div
            role="tablist"
            aria-label="Icon purpose"
            style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}
          >
            {iconPurposeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={activeIconPurpose === category.id}
                onClick={() => {
                  setActiveIconPurpose(category.id);
                  setSearch('');
                  setVisibleIconCount(120);
                }}
                style={{
                  minHeight: 34,
                  padding: '0 10px',
                  flex: '0 0 auto',
                  border: 0,
                  borderRadius: 9,
                  background:
                    activeIconPurpose === category.id ? tokens.surfaceSubtle : 'transparent',
                  color:
                    activeIconPurpose === category.id ? tokens.primary : tokens.foregroundMuted,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
        {kind === 'emoji' ? (
          <>
            <div
              role="tablist"
              aria-label="Emoji categories"
              style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}
            >
              {emojiTabs.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setSearch('');
                  }}
                  style={{
                    minHeight: 34,
                    padding: '0 10px',
                    flex: '0 0 auto',
                    border: 0,
                    borderRadius: 9,
                    background:
                      activeCategory === category.id ? tokens.surfaceSubtle : 'transparent',
                    color: activeCategory === category.id ? tokens.primary : tokens.foregroundMuted,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div
              role="grid"
              aria-label={
                search
                  ? 'Emoji search results'
                  : `${emojiTabs.find((category) => category.id === activeCategory)?.label ?? 'All'} emoji`
              }
              style={{
                maxHeight: 326,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
                gap: 6,
                padding: '2px 1px',
              }}
            >
              {matchingEmojis.map((emoji) => (
                <EmojiTile
                  key={emoji.id}
                  emoji={emoji}
                  selected={value === emoji.native}
                  onSelect={() => select(emoji.native)}
                />
              ))}
            </div>
            {matchingEmojis.length === 0 && (
              <Typography variant="small">No emoji match that search.</Typography>
            )}
          </>
        ) : (
          <>
            <div
              role="grid"
              aria-label={
                search
                  ? 'Icon search results'
                  : `${iconPurposeCategories.find((category) => category.id === activeIconPurpose)?.label ?? 'All icons'} catalog`
              }
              style={{
                maxHeight: 356,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))',
                gap: 6,
                padding: '2px 1px',
              }}
            >
              {displayedIcons.map((icon) => (
                <IconTile
                  key={icon.name}
                  icon={icon}
                  selected={value === `lucide:${icon.name}`}
                  onSelect={() => select(`lucide:${icon.name}`)}
                />
              ))}
            </div>
            {matchingIcons.length === 0 ? (
              <Typography variant="small">No Lucide icon matches that search.</Typography>
            ) : matchingIcons.length > displayedIcons.length ? (
              <Button variant="ghost" onPress={() => setVisibleIconCount((count) => count + 120)}>
                Show more icons ({matchingIcons.length - displayedIcons.length} remaining)
              </Button>
            ) : null}
          </>
        )}
        {allowClear && value && (
          <Button variant="ghost" onPress={() => select(undefined)}>
            Use automatic icon
          </Button>
        )}
      </Sheet>
    </>
  );
}
