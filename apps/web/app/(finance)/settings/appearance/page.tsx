'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Palette, Pipette } from 'lucide-react';
import { useTheme } from '@finapp/ui/web';
import {
  EntityColorPicker,
  SettingsChoice,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsShell,
} from '@finapp/ui/finance';
import type { Appearance } from '@finapp/ui/web';
import { accentPalette, isAccentColor, type AccentName } from '@finapp/ui/tokens';
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
  { value: 'volt', label: 'Volt', color: accentPalette.volt },
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
  const swatch = isAccentColor(accent)
    ? accent
    : (accents.find((option) => option.value === accent)?.color ?? accentPalette.volt);
  return (
    <SettingsShell
      title="Appearance"
      subtitle="Theme and accent colour"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: swatch,
              boxShadow: '0 0 0 2px var(--finapp-card), 0 0 0 3px var(--finapp-border)',
            }}
          />
        }
        title={`${options.find((option) => option.value === appearance)?.label ?? 'System'} theme`}
        description="Changes apply right away on this device and follow you to your other devices."
      />

      <SettingsGroup title="Theme">
        <SettingsChoice
          title="Mode"
          description="System follows your device’s light or dark setting"
          value={appearance}
          options={options}
          onChange={(next) => setAppearance(next)}
        />
      </SettingsGroup>

      <SettingsGroup title="Accent colour" description="Used for buttons, highlights and charts">
        <SettingsItem icon={<Palette size={19} />} tone="primary" title="Presets">
          <div
            role="radiogroup"
            aria-label="Accent colour"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
          >
            {accents.map((option) => {
              const selected = accent === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => void chooseAccent(option.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px 6px 6px',
                    borderRadius: 999,
                    border: `1px solid ${selected ? 'var(--finapp-primary)' : 'var(--finapp-border-subtle)'}`,
                    background: selected ? 'var(--finapp-surface-subtle)' : 'transparent',
                    color: 'var(--finapp-foreground)',
                    font: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: option.color,
                      border: option.value === 'white' ? '1px solid var(--finapp-border)' : 0,
                      color: option.value === 'white' ? '#000' : 'var(--finapp-primary-foreground)', // theme-exempt: contrast on a white swatch
                    }}
                  >
                    {selected ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </SettingsItem>
        <SettingsItem
          icon={<Pipette size={19} />}
          tone="violet"
          title="Custom colour"
          description={isAccentColor(accent) ? `Using ${accent}` : 'Pick any colour'}
          trailing={
            <EntityColorPicker
              value={swatch}
              onChange={(color) => void chooseAccent(color ?? accentPalette.volt)}
              label={isAccentColor(accent) ? 'Change custom accent' : 'Choose custom accent'}
            />
          }
        />
      </SettingsGroup>

      {accentError ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {accentError}
        </p>
      ) : null}
    </SettingsShell>
  );
}
