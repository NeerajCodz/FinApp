'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, IconButton, Sheet, Text, Typography, useTheme } from '@finapp/ui/web';
import type { Appearance } from '@finapp/ui/web';
import { isAccentColor, type AccentName } from '@finapp/ui/tokens';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

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
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState<string>(
    isAccentColor(accent) ? accent : '#B7FF4A',
  );
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
                  onPress={() => setAccent(option.value)}
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
            <Button
              variant={isAccentColor(accent) ? 'primary' : 'outline'}
              aria-pressed={isAccentColor(accent)}
              onPress={() => {
                setCustomColor(isAccentColor(accent) ? accent : '#B7FF4A');
                setColorPickerOpen(true);
              }}
              style={{ justifyContent: 'space-between', minHeight: 56 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isAccentColor(accent)
                      ? accent
                      : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  }}
                />
                Custom
              </span>
              {isAccentColor(accent) && <Check size={18} aria-hidden="true" />}
            </Button>
          </div>
        </section>
      </div>
      <Sheet
        visible={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
        title="Custom accent"
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Text>Pick a color for primary actions and highlights.</Text>
          <input
            aria-label="Custom accent color"
            type="color"
            value={customColor}
            onChange={(event) => setCustomColor(event.target.value.toUpperCase())}
            style={{ width: 72, height: 54, border: 0, background: 'transparent', padding: 0 }}
          />
          <Button
            disabled={!isAccentColor(customColor)}
            onPress={() => {
              if (!isAccentColor(customColor)) return;
              setAccent(customColor);
              setColorPickerOpen(false);
            }}
          >
            Use custom color
          </Button>
        </div>
      </Sheet>
    </>
  );
}
