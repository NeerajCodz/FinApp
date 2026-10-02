'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, IconButton, Text, Typography, useTheme } from '@finapp/ui/web';
import { EntityColorPicker } from '@finapp/ui/finance';
import type { Appearance } from '@finapp/ui/web';
import { isAccentColor, type AccentName } from '@finapp/ui/tokens';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

const options: { value: Appearance; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
];
const accents: { value: AccentName; label: string; color: string }[] = [
  { value: 'volt', label: 'Volt', color: '#B7FF4A' },
  { value: 'white', label: 'White', color: '#FFFFFF' },
  { value: 'blue', label: 'Blue', color: '#5B8CFF' },
];

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { appearance, setAppearance, accent, setAccent } = useTheme();
  const { records } = useLocalRecords<LocalRecord>('profile');
  const profile = records[0];
  const [accentError, setAccentError] = useState('');
  async function chooseAccent(next: string) {
    if (!userId) return;
    setAccent(next as typeof accent);
    setAccentError('');
    try {
      window.localStorage.setItem(`finapp.appearance.accent.v1:${userId}`, next);
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
  if (!userId)
    return (
      <FinanceSignedOut
        section="APPEARANCE"
        title="Make this space feel right."
        description="Sign in to choose the appearance saved in this browser."
      />
    );
  return (
    <>
      <div className="finance-page">
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.push('/settings')}>
            <ArrowLeft size={21} aria-hidden="true" />
          </IconButton>
          <Typography variant="title">Appearance</Typography>
        </header>
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label">Theme</Typography>
          <Text style={{ maxWidth: 300 }}>
            Choose the app theme. System follows your device setting.
          </Text>
          <div style={{ display: 'grid', gap: 8 }}>
            {options.map((option) => {
              const selected = appearance === option.value;
              return (
                <Button
                  key={option.value}
                  variant={selected ? 'primary' : 'outline'}
                  aria-pressed={selected}
                  onPress={() => setAppearance(option.value)}
                  style={{ justifyContent: 'space-between', minHeight: 56 }}
                >
                  <span>{option.label}</span>
                  {selected && <Check size={18} aria-hidden="true" />}
                </Button>
              );
            })}
          </div>
        </section>
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label">Accent color</Typography>
          {accentError && <Text role="status">{accentError}</Text>}
          <Text style={{ maxWidth: 320 }}>
            Choose the color used for primary actions and highlights.
          </Text>
          <div style={{ display: 'grid', gap: 8 }}>
            {accents.map((option) => {
              const selected = accent === option.value;
              return (
                <Button
                  key={option.value}
                  variant={selected ? 'primary' : 'outline'}
                  aria-pressed={selected}
                  onPress={() => void chooseAccent(option.value)}
                  style={{ justifyContent: 'space-between', minHeight: 56 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: option.color,
                        border: option.value === 'white' ? '1px solid var(--finapp-border)' : 0,
                      }}
                    />
                    {option.label}
                  </span>
                  {selected && <Check size={18} aria-hidden="true" />}
                </Button>
              );
            })}
            <EntityColorPicker
              value={
                isAccentColor(accent)
                  ? accent
                  : accents.find((option) => option.value === accent)?.color
              }
              onChange={(color) => void chooseAccent(color ?? '#B7FF4A')}
              label={isAccentColor(accent) ? 'Change custom accent' : 'Choose custom accent'}
            />
          </div>
        </section>
      </div>
    </>
  );
}
