import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Palette, Pipette } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  EntityColorPicker,
  SettingsChoice,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { accentPalette, isAccentColor, type AccentName } from '@finapp/ui/tokens';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import Storage from 'expo-sqlite/kv-store';
const accents: { value: AccentName; label: string; color: string }[] = [
  { value: 'volt', label: 'Volt', color: accentPalette.volt },
  { value: 'white', label: 'White', color: '#FFFFFF' },
  { value: 'blue', label: 'Blue', color: '#5B8CFF' },
];

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, accent, setAccent, tokens } = useTheme();
  const tone = useSettingsToneColor();
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
  const swatch = isAccentColor(accent)
    ? accent
    : (accents.find((option) => option.value === accent)?.color ?? accentPalette.volt);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <SettingsScreen title="Appearance" subtitle="Theme and accent colour" onBack={back}>
      <SettingsHero
        icon={
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: swatch,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          />
        }
        title={`${appearance === 'dark' ? 'Dark' : appearance === 'light' ? 'Light' : 'System'} theme`}
        description="Changes apply right away and follow you to your other devices."
      />
      <SettingsGroup title="Theme">
        <SettingsChoice
          title="Mode"
          description="System follows your phone’s setting"
          value={appearance}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
          ]}
          onChange={(next) => setAppearance(next)}
        />
      </SettingsGroup>
      <SettingsGroup title="Accent colour">
        <SettingsItem
          icon={<Palette size={19} color={tone('primary')} />}
          tone="primary"
          title="Presets"
        >
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {accents.map((option) => {
              const selected = accent === option.value;
              // theme-exempt: a dark check stays readable on the white swatch
              const checkColor = option.value === 'white' ? '#000000' : tokens.primaryForeground;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option.label}
                  onPress={() => void chooseAccent(option.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 6,
                    paddingLeft: 6,
                    paddingRight: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? tokens.primary : tokens.borderSubtle,
                    backgroundColor: selected ? tokens.surfaceSubtle : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: option.color,
                      borderWidth: option.value === 'white' ? 1 : 0,
                      borderColor: tokens.border,
                    }}
                  >
                    {selected ? <Check size={13} strokeWidth={3} color={checkColor} /> : null}
                  </View>
                  <Text style={{ color: tokens.foreground, fontSize: 13 }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsItem>
        <SettingsItem
          icon={<Pipette size={19} color={tone('violet')} />}
          tone="violet"
          title="Custom colour"
          description={isAccentColor(accent) ? `Using ${accent}` : 'Pick any colour'}
        >
          <EntityColorPicker
            value={swatch}
            onChange={(color) => void chooseAccent(color ?? accentPalette.volt)}
            label={isAccentColor(accent) ? 'Change custom accent' : 'Choose custom accent'}
          />
        </SettingsItem>
      </SettingsGroup>
      {accentError ? (
        <SettingsGroup>
          <SettingsItem title="Couldn’t save" description={accentError} />
        </SettingsGroup>
      ) : null}
    </SettingsScreen>
  );
}
