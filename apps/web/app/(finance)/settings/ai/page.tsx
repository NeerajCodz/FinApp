'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Bot, KeyRound, LayoutDashboard, PlugZap } from 'lucide-react';
import { FinaiLogo } from '@finapp/ui/ai';
import { SettingsGroup, SettingsHero, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

/** AI hub: FinAI, your own API keys and MCP connections. */
export default function AiSettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const finai = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 50 } : 'skip');
  const active = grants?.filter((grant) => grant.revokedAt === undefined).length ?? 0;
  return (
    <SettingsShell
      title="AI"
      subtitle="FinAI, your own model keys and connected AI apps"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={<FinaiLogo size={28} />}
        title={finai?.enabled === false ? 'FinAI is off' : 'FinAI is on'}
        description="Your assistant for spending, budgets, goals and splits. Every change it prepares waits for your confirmation."
      />
      <SettingsGroup>
        <SettingsLink
          icon={<Bot size={19} />}
          tone="violet"
          title="FinAI"
          description="Personality, language, what it can read, actions, chat mentions and history"
          onPress={() => router.push('/settings/ai/finai')}
        />
        <SettingsLink
          icon={<KeyRound size={19} />}
          tone="warning"
          title="API keys (BYOK)"
          description="Use your own OpenAI, Anthropic, Gemini, OpenRouter or compatible key"
          onPress={() => router.push('/settings/ai/keys')}
        />
        <SettingsLink
          icon={<PlugZap size={19} />}
          tone="info"
          title="MCP connections"
          description="Apps like ChatGPT and Claude that can use your Finapp"
          value={grants ? `${active} active` : undefined}
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
    </SettingsShell>
  );
}
