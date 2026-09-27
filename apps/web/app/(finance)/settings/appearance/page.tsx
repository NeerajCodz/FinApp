'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, IconButton, Text, Typography, useTheme } from '@finapp/ui/web';
import type { Appearance } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

const options: { value: Appearance; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
];

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { appearance, setAppearance } = useTheme();
  if (!userId)
    return (
      <FinanceSignedOut
        section="APPEARANCE"
        title="Make this space feel right."
        description="Sign in to choose the appearance saved in this browser."
      />
    );
  return (
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
    </div>
  );
}
