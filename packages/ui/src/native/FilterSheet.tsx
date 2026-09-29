import React, { useState } from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { Sheet } from './overlays';

export type FilterSheetOption = { label: string; value: string };

export function FilterSheet({
  label,
  title = label,
  options,
  value,
  onChange,
}: {
  label: string;
  title?: string;
  options: readonly FilterSheetOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Button
        accessibilityLabel={`${label}: ${selected?.label ?? value}. Change ${label.toLowerCase()}`}
        accessibilityState={{ expanded: visible }}
        variant="ghost"
        size="sm"
        onPress={() => setVisible(true)}
      >
        {label}: {selected?.label ?? value}
      </Button>
      <Sheet visible={visible} onClose={() => setVisible(false)} title={title}>
        <View style={{ gap: 8 }}>
          {options.map((option) => (
            <Button
              key={option.value}
              variant={option.value === value ? 'primary' : 'ghost'}
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setVisible(false);
              }}
              style={{ justifyContent: 'flex-start', minHeight: 50 }}
            >
              {option.label}
            </Button>
          ))}
        </View>
      </Sheet>
    </>
  );
}
