import React, { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Text, useTheme } from '@finapp/ui/native';
import {
  colorHueOptions,
  entityColorSwatches,
  getColorToneSwatches,
  hslToHex,
} from '../color-picker-data';

export function EntityColorPicker({
  value,
  onChange,
  compact = false,
  label,
  disabled = false,
}: {
  value?: string;
  onChange: (value?: string) => void;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customColor, setCustomColor] = useState(
    /^#[\da-f]{6}$/i.test(value ?? '') ? value!.toUpperCase() : '#000000',
  );
  const [customHue, setCustomHue] = useState(90);
  const triggerLabel = label ?? (value ? 'Change color' : 'Choose color');

  const close = () => {
    setOpen(false);
    setCustomOpen(false);
  };
  const showCustom = () => {
    setCustomColor(/^#[\da-f]{6}$/i.test(value ?? '') ? value!.toUpperCase() : '#000000');
    setCustomOpen(true);
  };

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
        disabled={disabled}
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
        {!compact && <Text>{triggerLabel}</Text>}
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close color picker"
            onPress={close}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: tokens.overlay,
            }}
          />
          <View
            accessibilityLabel={customOpen ? 'Choose a custom color' : 'Choose a color'}
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: 360,
              gap: 14,
              padding: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
              elevation: 12,
            }}
          >
            {customOpen ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>Custom color</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to color choices"
                    onPress={() => setCustomOpen(false)}
                    style={{
                      minWidth: 48,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: tokens.foregroundMuted }}>Back</Text>
                  </Pressable>
                </View>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Choose hue"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                >
                  {colorHueOptions.map((hue) => (
                    <Pressable
                      key={hue}
                      accessibilityRole="radio"
                      accessibilityLabel={`${hue} degrees hue`}
                      accessibilityState={{ selected: customHue === hue }}
                      onPress={() => setCustomHue(hue)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: customHue === hue ? 2 : 1,
                        borderColor: customHue === hue ? tokens.foreground : tokens.borderSubtle,
                        backgroundColor: hslToHex(hue, 100, 50),
                      }}
                    />
                  ))}
                </View>
                <View
                  accessibilityLabel="Color tones"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}
                >
                  {getColorToneSwatches(customHue).map((color) => (
                    <Pressable
                      key={color}
                      accessibilityRole="button"
                      accessibilityLabel={`${color} tone`}
                      accessibilityState={{ selected: customColor.toUpperCase() === color }}
                      onPress={() => setCustomColor(color)}
                      style={{
                        width: '15%',
                        aspectRatio: 1,
                        borderRadius: 7,
                        borderWidth: 2,
                        borderColor:
                          customColor.toUpperCase() === color
                            ? tokens.foreground
                            : tokens.borderSubtle,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: tokens.foregroundMuted }}>
                  Enter a hex color to fine tune.
                </Text>
                <TextInput
                  accessibilityLabel="Hex color"
                  value={customColor}
                  onChangeText={setCustomColor}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  placeholder="#RRGGBB"
                  placeholderTextColor={tokens.foregroundMuted}
                  selectionColor={tokens.primary}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    borderRadius: 10,
                    backgroundColor: tokens.background,
                    color: tokens.foreground,
                    fontSize: 17,
                  }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: tokens.borderSubtle,
                      backgroundColor: /^#[\da-f]{6}$/i.test(customColor)
                        ? customColor
                        : 'transparent',
                    }}
                  />
                  <Text style={{ flex: 1, color: tokens.foregroundMuted }}>
                    {/^#[\da-f]{6}$/i.test(customColor)
                      ? customColor.toUpperCase()
                      : 'Use # followed by 6 digits'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apply custom color"
                  accessibilityState={{ disabled: !/^#[\da-f]{6}$/i.test(customColor) }}
                  disabled={!/^#[\da-f]{6}$/i.test(customColor)}
                  onPress={() => {
                    onChange(customColor.toUpperCase());
                    close();
                  }}
                  style={{
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    backgroundColor: tokens.primary,
                    opacity: /^#[\da-f]{6}$/i.test(customColor) ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: tokens.primaryForeground, fontWeight: '600' }}>
                    Apply color
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: '600' }}>Choose a color</Text>
                <View
                  accessibilityLabel="Color swatches"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {entityColorSwatches.map(({ name, value: color }) => {
                    const selected = value?.toLowerCase() === color.toLowerCase();
                    return (
                      <Pressable
                        key={color}
                        accessibilityRole="button"
                        accessibilityLabel={`${name} color`}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          onChange(color);
                          close();
                        }}
                        style={{
                          width: '22%',
                          aspectRatio: 1,
                          minHeight: 48,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? tokens.foreground : tokens.borderSubtle,
                          backgroundColor: color,
                        }}
                      />
                    );
                  })}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose a custom color"
                  onPress={showCustom}
                  style={{
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>Custom…</Text>
                </Pressable>
                {value && (
                  <Button
                    variant="ghost"
                    accessibilityLabel="Clear color"
                    onPress={() => {
                      onChange(undefined);
                      close();
                    }}
                  >
                    Use default color
                  </Button>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
