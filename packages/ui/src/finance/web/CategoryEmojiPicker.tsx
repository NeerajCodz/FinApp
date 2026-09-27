import React, { useMemo, useState } from 'react';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/web';
import { categoryEmojiOptions as EMOJI } from '@finapp/ui/category-emoji';

export function CategoryEmojiPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: string;
  onChange: (emoji?: string) => void;
  compact?: boolean;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? EMOJI.filter(([, terms]) => terms.includes(needle)) : EMOJI;
  }, [search]);

  function select(emoji?: string) {
    onChange(emoji);
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={value ? 'Change category emoji' : 'Choose category emoji'}
        onPress={() => setOpen(true)}
        style={compact ? undefined : { alignSelf: 'flex-start' }}
      >
        {compact ? (
          <Text style={{ fontSize: 23 }}>{value ?? '＋'}</Text>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 25, lineHeight: 31 }}>{value ?? '＋'}</Text>
            <Typography variant="small" style={{ color: tokens.foreground }}>
              {value ? 'Change emoji' : 'Choose emoji'}
            </Typography>
          </span>
        )}
      </Button>
      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setSearch('');
        }}
        title="Choose a category emoji"
      >
        <Input
          accessibilityLabel="Search emoji"
          placeholder="Search food, travel, bills…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <div
          style={{
            maxHeight: 330,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 6,
            marginTop: 8,
          }}
        >
          {filtered.map(([emoji, terms]) => (
            <button
              key={emoji}
              type="button"
              aria-label={`${emoji} ${terms.split(' ')[0]}`}
              aria-pressed={value === emoji}
              onClick={() => select(emoji)}
              style={{
                aspectRatio: '1',
                border: 0,
                borderRadius: 12,
                background: value === emoji ? tokens.surfaceSubtle : tokens.surfaceRaised,
                color: tokens.foreground,
                cursor: 'pointer',
                fontSize: 26,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <Typography variant="small">No emoji match that search.</Typography>
        )}
        {!!value && (
          <Button variant="ghost" onPress={() => select(undefined)}>
            Use automatic icon
          </Button>
        )}
      </Sheet>
    </>
  );
}
