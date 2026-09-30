import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, IconButton, Input, Sheet, Text, Typography } from '@finapp/ui/native';
import { isAccentColor, type AccentName } from '@finapp/ui/tokens';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import Storage from 'expo-sqlite/kv-store';
const accents: { value: AccentName; label: string; color: string }[] = [
  { value: 'volt', label: 'Volt', color: '#B7FF4A' },
  { value: 'white', label: 'White', color: '#FFFFFF' },
  { value: 'blue', label: 'Blue', color: '#5B8CFF' },
];
const customPalette = ['#B7FF4A', '#FFFFFF', '#5B8CFF', '#9D7BFF', '#FF9A51', '#FF6E9C'];

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, accent, setAccent, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState<string>(
    isAccentColor(accent) ? accent : '#B7FF4A',
  );
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const [accentError, setAccentError] = useState('');
  async function chooseAccent(next: string) {
    if (!userId) return;
    setAccent(next as typeof accent);
    setAccentError('');
    try {
      Storage.setItemSync(`finapp.appearance.accent.v1:${userId}`, next);
    } catch {
      // Cloud persistence remains available if local cache storage is blocked.
    }
    try {
      const current = profile ?? { id: userId };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        { ...current, accent: next },
        { accent: next },
        { recordId: String(current.id ?? current._id ?? userId) },
      );
    } catch {
      setAccentError('Could not save this accent on this device.');
    }
  }
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          gap: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="title">Appearance</Typography>
        </View>

        <View style={{ gap: 12 }}>
          <Typography variant="label">Theme</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
            Choose the app theme. System follows your device setting.
          </Text>
          <View style={{ gap: 8 }}>
            {(['dark', 'system', 'light'] as const).map((option) => {
              const selected = appearance === option;
              const label = option.charAt(0).toUpperCase() + option.slice(1);
              return (
                <Button
                  key={option}
                  variant={selected ? 'primary' : 'outline'}
                  onPress={() => setAppearance(option)}
                  style={{ justifyContent: 'space-between', minHeight: 56 }}
                >
                  <Text
                    style={{
                      color: selected ? tokens.primaryForeground : tokens.foreground,
                      fontFamily: 'SpaceGrotesk_500Medium',
                    }}
                  >
                    {label}
                  </Text>
                  {selected && <Check size={18} color={tokens.primaryForeground} />}
                </Button>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Typography variant="label">Accent color</Typography>
          {accentError ? (
            <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {accentError}
            </Text>
          ) : null}
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
            Choose the color used for primary actions and highlights.
          </Text>
          <View style={{ gap: 8 }}>
            {accents.map((option) => {
              const selected = accent === option.value;
              return (
                <Button
                  key={option.value}
                  variant={selected ? 'primary' : 'outline'}
                  accessibilityState={{ selected }}
                  onPress={() => void chooseAccent(option.value)}
                  style={{ justifyContent: 'space-between', minHeight: 56 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: option.color,
                        borderWidth: option.value === 'white' ? 1 : 0,
                        borderColor: tokens.border,
                      }}
                    />
                    <Text
                      style={{ color: selected ? tokens.primaryForeground : tokens.foreground }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {selected && <Check size={18} color={tokens.primaryForeground} />}
                </Button>
              );
            })}
            <Button
              variant={isAccentColor(accent) ? 'primary' : 'outline'}
              accessibilityState={{ selected: isAccentColor(accent) }}
              onPress={() => {
                setCustomColor(isAccentColor(accent) ? accent : '#B7FF4A');
                setColorPickerOpen(true);
              }}
              style={{ justifyContent: 'space-between', minHeight: 56 }}
            >
              <Text
                style={{
                  color: isAccentColor(accent) ? tokens.primaryForeground : tokens.foreground,
                }}
              >
                Custom
              </Text>
              {isAccentColor(accent) && <Check size={18} color={tokens.primaryForeground} />}
            </Button>
          </View>
        </View>
      </ScrollView>
      <Sheet
        visible={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
        title="Custom accent"
      >
        <View style={{ gap: 14 }}>
          <Text style={{ color: tokens.foregroundMuted }}>
            Choose a swatch or enter any six-digit hex color.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {customPalette.map((color) => (
              <Button
                key={color}
                accessibilityLabel={`Choose ${color}`}
                variant="ghost"
                onPress={() => {
                  setCustomColor(color);
                }}
                style={{
                  width: 42,
                  minWidth: 42,
                  height: 42,
                  minHeight: 42,
                  borderRadius: 21,
                  padding: 0,
                  backgroundColor: color,
                  borderWidth: customColor === color ? 2 : color === '#FFFFFF' ? 1 : 0,
                  borderColor: customColor === color ? tokens.primary : tokens.border,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: color,
                  }}
                />
              </Button>
            ))}
          </View>
          <Input
            accessibilityLabel="Custom accent hex"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            placeholder="#B7FF4A"
            value={customColor}
            onChangeText={(value) => {
              setCustomColor(value.toUpperCase());
            }}
          />
          {!isAccentColor(customColor) && (
            <Text style={{ color: tokens.destructive }}>
              Enter a valid hex color, such as #5B8CFF.
            </Text>
          )}
          <Button
            disabled={!isAccentColor(customColor)}
            onPress={() => {
              if (!isAccentColor(customColor)) return;
              void chooseAccent(customColor);
              setColorPickerOpen(false);
            }}
          >
            Use custom color
          </Button>
        </View>
      </Sheet>
    </>
  );
}
