import React from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
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
  Palette,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
  LayoutDashboard,
} from 'lucide-react-native';
import {
  SettingsGroup,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useTheme } from '@finapp/ui/native';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const back = () =>
  router.canGoBack() ? router.back() : router.navigate('/(tabs)/profile' as never);

export default function SettingsHubScreen() {
  const { userId, isConnected, syncWindow } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const { data: profiles } = useLocalRecords<Record<string, unknown>>(userId, 'profile');
  const profile = profiles?.[0];
  const { appearance } = useTheme();
  const tone = useSettingsToneColor();
  const finai = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 50 } : 'skip');
  const active = grants?.filter((grant) => grant.revokedAt === undefined).length ?? 0;
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const go = (path: string) => () => router.push(path as never);
  return (
    <SettingsScreen title="Settings" subtitle="Account, preferences, AI and privacy" onBack={back}>
      <SettingsGroup title="Account">
        <SettingsLink
          icon={<CircleUserRound size={19} color={tone('primary')} />}
          tone="primary"
          title="Edit profile"
          description="Name, username, photo and contact details"
          onPress={go('/profile/edit')}
        />
        <SettingsLink
          icon={<ShieldCheck size={19} color={tone('positive')} />}
          tone="positive"
          title="Security"
          description="Two-factor, devices, sign-in alerts and app lock"
          onPress={go('/settings/security')}
        />
      </SettingsGroup>

      <SettingsGroup title="AI">
        <SettingsLink
          icon={<Bot size={19} color={tone('violet')} />}
          tone="violet"
          title="FinAI"
          description="Tone, language, data access, actions and chat mentions"
          value={finai ? (finai.enabled ? 'On' : 'Off') : undefined}
          onPress={go('/settings/ai/finai')}
        />
        <SettingsLink
          icon={<KeyRound size={19} color={tone('warning')} />}
          tone="warning"
          title="API keys"
          description="Bring your own model key"
          onPress={go('/settings/ai/keys')}
        />
        <SettingsLink
          icon={<PlugZap size={19} color={tone('info')} />}
          tone="info"
          title="MCP connections"
          description="ChatGPT, Claude and other AI apps"
          value={grants ? `${active} active` : undefined}
          onPress={go('/settings/ai/mcp')}
        />
        <SettingsLink
          icon={<LayoutDashboard size={19} color={tone('primary')} />}
          tone="primary"
          title="MCP dashboard"
          description="Tools, activity and OAuth setup (opens the web)"
          onPress={() => void Linking.openURL('https://fin.neeraj.fyi/mcp/dashboard')}
        />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsLink
          icon={<Palette size={19} color={tone('violet')} />}
          tone="violet"
          title="Appearance"
          value={`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}`}
          onPress={go('/settings/appearance')}
        />
        <SettingsLink
          icon={<Coins size={19} color={tone('warning')} />}
          tone="warning"
          title="Currency"
          value={currency}
          onPress={go('/settings/currency')}
        />
        <SettingsLink
          icon={<Bell size={19} color={tone('info')} />}
          tone="info"
          title="Notifications"
          onPress={go('/settings/notifications')}
        />
      </SettingsGroup>

      <SettingsGroup title="Data and privacy">
        <SettingsLink
          icon={<RefreshCw size={19} color={tone('positive')} />}
          tone="positive"
          title="Sync"
          value={syncWindow === 'all' ? 'All history' : `${syncWindow} days`}
          onPress={go('/settings/sync')}
        />
        <SettingsLink
          icon={<Trash2 size={19} color={tone('danger')} />}
          tone="danger"
          title="Trash"
          description="Restore deleted items; choose when they’re cleared"
          onPress={go('/trash')}
        />
        <SettingsLink
          icon={<Eye size={19} color={tone('primary')} />}
          tone="primary"
          title="Privacy"
          description="Who can find you, export and account"
          onPress={go('/settings/privacy')}
        />
        <SettingsLink
          icon={<Info size={19} color={tone()} />}
          title="About"
          description="Version, updates and diagnostics"
          onPress={go('/about')}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
