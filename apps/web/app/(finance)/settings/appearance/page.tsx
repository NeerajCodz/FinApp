'use client';

import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import type { Appearance } from '@finapp/ui/web';
import { useTheme } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

const options: { value: Appearance; label: string; detail: string }[] = [
  { value: 'dark', label: 'Dark', detail: 'Keep the dark Finapp canvas.' },
  { value: 'light', label: 'Light', detail: 'Use the light palette.' },
  { value: 'system', label: 'System', detail: 'Follow this device’s appearance setting.' },
];

export default function AppearanceSettingsPage() {
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
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">PREFERENCES</p>
          <h1>Appearance</h1>
          <p className="finance-muted">Theme changes are saved in this browser.</p>
        </div>
        <Link className="finance-secondary-action" href="/settings">
          <ArrowLeft size={15} aria-hidden="true" /> Settings
        </Link>
      </header>
      <Card className="finance-record-panel" style={{ display: 'grid', gap: 12 }}>
        <SectionHeader title="Theme" />
        <p className="finance-form-note">
          System follows the current device preference. Your selection is stored as
          finapp.appearance.mode.v1.
        </p>
        {options.map((option) => {
          const selected = appearance === option.value;
          return (
            <Button
              key={option.value}
              variant={selected ? 'secondary' : 'outline'}
              aria-pressed={selected}
              onPress={() => setAppearance(option.value)}
              style={{ minHeight: 58, justifyContent: 'space-between', textAlign: 'left' }}
            >
              <span style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
              {selected && <Check size={17} aria-hidden="true" />}
            </Button>
          );
        })}
      </Card>
    </div>
  );
}
