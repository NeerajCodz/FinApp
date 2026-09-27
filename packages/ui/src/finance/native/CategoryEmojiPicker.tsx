import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 25, lineHeight: 31 }}>{value ?? '＋'}</Text>
            <Typography variant="small" style={{ color: tokens.foreground }}>
              {value ? 'Change emoji' : 'Choose emoji'}
            </Typography>
          </View>
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
          autoCorrect={false}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 330 }}
          contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
        >
          {filtered.map(([emoji, terms]) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`${emoji} ${terms.split(' ')[0]}`}
              accessibilityState={{ selected: value === emoji }}
              onPress={() => select(emoji)}
              style={{
                width: '18%',
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: value === emoji ? tokens.surfaceSubtle : tokens.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
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
