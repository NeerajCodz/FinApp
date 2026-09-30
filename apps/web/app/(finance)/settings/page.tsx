'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  CircleUserRound,
  Coins,
  Eye,
  Info,
  Palette,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { IconButton, Separator, Typography, useTheme } from '@finapp/ui/web';
import { SettingsRow } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { defaultCurrency?: string };

export default function SettingsPage() {
  const router = useRouter();
  const { userId, syncWindow } = useBrowserSync();
  const { appearance, tokens } = useTheme();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  if (!userId)
    return (
      <FinanceSignedOut
        section="YOUR ACCOUNT"
        title="Settings are ready when you are."
        description="Sign in to choose how Finapp looks, stores money, and protects your data."
      />
    );

  const syncWindowLabel = syncWindow === 'all' ? 'All history' : `${syncWindow} days`;
  return (
    <div className="finance-page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.push('/profile')}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Settings</Typography>
      </header>

      <section>
        <Typography variant="label" style={{ display: 'block', marginBottom: 8 }}>
          General
        </Typography>
        <SettingsRow
          label="Edit profile"
          leadingIcon={<CircleUserRound size={19} color={tokens.primary} />}
          onPress={() => router.push('/profile/edit')}
        />
        <Separator />
        <SettingsRow
          label="Appearance"
          value={`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}`}
          leadingIcon={<Palette size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/appearance')}
        />
        <Separator />
        <SettingsRow
          label="Currency"
          value={profile?.defaultCurrency ?? 'INR'}
          leadingIcon={<Coins size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/currency')}
        />
      </section>

      <section>
        <Typography variant="label" style={{ display: 'block', marginBottom: 8 }}>
          Preferences
        </Typography>
        <SettingsRow
          label="Notifications"
          leadingIcon={<Bell size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/notifications')}
        />
        <Separator />
        <SettingsRow
          label="Security"
          leadingIcon={<ShieldCheck size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/security')}
        />
      </section>

      <section>
        <Typography variant="label" style={{ display: 'block', marginBottom: 8 }}>
          Data
        </Typography>
        <SettingsRow
          label="Local sync"
          value={syncWindowLabel}
          leadingIcon={<RefreshCw size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/sync')}
        />
        <Separator />
        <SettingsRow
          label="Privacy and export"
          leadingIcon={<Eye size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/privacy')}
        />
      </section>
      <section>
        <SettingsRow
          label="About"
          leadingIcon={<Info size={19} color={tokens.primary} />}
          onPress={() => router.push('/about')}
        />
      </section>
    </div>
  );
}
