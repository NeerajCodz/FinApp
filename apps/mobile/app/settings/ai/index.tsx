import React from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Bot, KeyRound, PlugZap, LayoutDashboard } from 'lucide-react-native';
import { FinaiLogo } from '@finapp/ui/ai';
import {
  SettingsGroup,
  SettingsHero,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings' as never));

export default function AiSettingsHub() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const tone = useSettingsToneColor();
  const finai = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 50 } : 'skip');
  const active = grants?.filter((grant) => grant.revokedAt === undefined).length ?? 0;
  return (
    <SettingsScreen
      title="AI"
      subtitle="FinAI, your own model keys and connected AI apps"
      onBack={back}
    >
      <SettingsHero
        icon={<FinaiLogo size={26} />}
        title={finai?.enabled === false ? 'FinAI is off' : 'FinAI is on'}
        description="Every change FinAI prepares waits for your confirmation."
      />
      <SettingsGroup>
        <SettingsLink
          icon={<Bot size={19} color={tone('violet')} />}
          tone="violet"
          title="FinAI"
          description="Personality, data access, actions, chats and history"
          onPress={() => router.push('/settings/ai/finai' as never)}
        />
        <SettingsLink
          icon={<KeyRound size={19} color={tone('warning')} />}
          tone="warning"
          title="API keys (BYOK)"
          description="OpenAI, Anthropic, Gemini, OpenRouter or compatible"
          onPress={() => router.push('/settings/ai/keys' as never)}
        />
        <SettingsLink
          icon={<PlugZap size={19} color={tone('info')} />}
          tone="info"
          title="MCP connections"
          description="Apps like ChatGPT and Claude"
          value={grants ? `${active} active` : undefined}
          onPress={() => router.push('/settings/ai/mcp' as never)}
        />
        <SettingsLink
          icon={<LayoutDashboard size={19} color={tone('primary')} />}
          tone="primary"
          title="MCP dashboard"
          description="Tools, activity and OAuth setup (opens the web)"
          onPress={() => void Linking.openURL('https://fin.neeraj.fyi/mcp/dashboard')}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
