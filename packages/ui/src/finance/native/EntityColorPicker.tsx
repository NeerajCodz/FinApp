import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Sheet, Text, useTheme } from '@finapp/ui/native';

const colorSwatches = [
  '#B7FF4A',
  '#71B8FF',
  '#FF7777',
  '#BA8AFF',
  '#FFD44F',
  '#FF9C5B',
  '#54D6A1',
  '#FF80B6',
];

export function EntityColorPicker({
  value,
  onChange,
  compact = false,
  label,
}: {
  value?: string;
  onChange: (value?: string) => void;
  compact?: boolean;
  label?: string;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerLabel = label ?? (value ? 'Change color' : 'Choose color');

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
        onPress={() => setOpen(true)}
        style={compact ? undefined : { alignSelf: 'flex-start', flexDirection: 'row', gap: 10 }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: value ?? 'transparent',
          }}
        />
        {!compact && <Text>{label ?? (value ? 'Change color' : 'Choose color')}</Text>}
      </Button>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Choose a color">
        <View style={{ gap: 12, padding: 4 }}>
          <View
            accessibilityLabel="Color swatches"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {colorSwatches.map((color) => {
              const selected = value?.toLowerCase() === color.toLowerCase();
              return (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(color);
                    setOpen(false);
                  }}
                  style={{
                    width: '14%',
                    aspectRatio: 1,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selected ? tokens.foreground : tokens.borderSubtle,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </View>
          {value && (
            <Button
              variant="ghost"
              accessibilityLabel="Clear color"
              onPress={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Use default color
            </Button>
          )}
        </View>
      </Sheet>
    </>
  );
}
