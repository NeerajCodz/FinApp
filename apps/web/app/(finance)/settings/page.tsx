'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Bell,
  Bot,
  CircleUserRound,
  Coins,
  Eye,
  Info,
  KeyRound,
  LayoutDashboard,
  Palette,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@finapp/ui/web';
import { SettingsGroup, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { defaultCurrency?: string; displayName?: string };

export default function SettingsPage() {
  const router = useRouter();
  const { userId, isConnected, syncWindow } = useBrowserSync();
  const { appearance } = useTheme();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const finai = useQuery(api.ai.settings.get, userId && isConnected ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, userId && isConnected ? { limit: 50 } : 'skip');
  const profile = profiles[0];
  if (!userId)
    return (
      <FinanceSignedOut
        section="YOUR ACCOUNT"
        title="Settings are ready when you are."
        description="Sign in to choose how Finapp looks, stores money, and protects your data."
      />
    );

  const activeConnections = grants?.filter((grant) => grant.revokedAt === undefined).length ?? 0;
  const capital = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  return (
    <SettingsShell
      title="Settings"
      subtitle="Account, preferences, AI and privacy"
      onBack={() => router.push('/profile')}
      wide
    >
      <SettingsGroup title="Account">
        <SettingsLink
          icon={<CircleUserRound size={19} />}
          tone="primary"
          title="Edit profile"
          description="Name, username, photo and contact details"
          onPress={() => router.push('/profile/edit')}
        />
        <SettingsLink
          icon={<ShieldCheck size={19} />}
          tone="positive"
          title="Security"
          description="Password, two-factor and app lock"
          onPress={() => router.push('/settings/security')}
        />
      </SettingsGroup>

      <SettingsGroup title="AI">
        <SettingsLink
          icon={<Bot size={19} />}
          tone="violet"
          title="FinAI"
          description="Tone, language, data access, actions and chat mentions"
          value={finai ? (finai.enabled ? 'On' : 'Off') : undefined}
          onPress={() => router.push('/settings/ai/finai')}
        />
        <SettingsLink
          icon={<KeyRound size={19} />}
          tone="warning"
          title="API keys"
          description="Bring your own OpenAI, Anthropic, Gemini or OpenRouter key"
          onPress={() => router.push('/settings/ai/keys')}
        />
        <SettingsLink
          icon={<PlugZap size={19} />}
          tone="info"
          title="MCP connections"
          description="ChatGPT, Claude and other apps connected to your Finapp"
          value={grants ? `${activeConnections} active` : undefined}
          onPress={() => router.push('/settings/ai/mcp')}
        />
        <SettingsLink
          icon={<LayoutDashboard size={19} />}
          tone="primary"
          title="MCP dashboard"
          description="Server URL, tools, widgets, activity and OAuth setup"
          onPress={() => router.push('/mcp/dashboard')}
        />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsLink
          icon={<Palette size={19} />}
          tone="violet"
          title="Appearance"
          description="Theme and accent colour"
          value={capital(appearance)}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingsLink
          icon={<Coins size={19} />}
          tone="warning"
          title="Currency"
          description="Default currency for new records"
          value={profile?.defaultCurrency ?? 'INR'}
          onPress={() => router.push('/settings/currency')}
        />
        <SettingsLink
          icon={<Bell size={19} />}
          tone="info"
          title="Notifications"
          description="Reminders, group activity and alerts"
          onPress={() => router.push('/settings/notifications')}
        />
      </SettingsGroup>

      <SettingsGroup title="Data and privacy">
        <SettingsLink
          icon={<RefreshCw size={19} />}
          tone="positive"
          title="Local sync"
          description="How much history this browser keeps offline"
          value={syncWindow === 'all' ? 'All history' : `${syncWindow} days`}
          onPress={() => router.push('/settings/sync')}
        />
        <SettingsLink
          icon={<Trash2 size={19} />}
          tone="danger"
          title="Trash"
          description="Restore deleted items and choose when they’re cleared"
          onPress={() => router.push('/trash')}
        />
        <SettingsLink
          icon={<Eye size={19} />}
          tone="primary"
          title="Privacy and export"
          description="Presence, visibility and data export"
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingsLink
          icon={<Info size={19} />}
          title="About"
          description="Version, updates and diagnostics"
          onPress={() => router.push('/about')}
        />
      </SettingsGroup>
    </SettingsShell>
  );
}
