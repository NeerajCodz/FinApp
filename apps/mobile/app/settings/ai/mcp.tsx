import React from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ExternalLink, KeySquare, PlugZap, Unplug } from 'lucide-react-native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings/ai' as never));
const SCOPES: Record<string, string> = {
  'finapp:read': 'Read',
  'finapp:write:finance': 'Money',
  'finapp:write:social': 'Social',
  'finapp:write:groups': 'Groups',
  'finapp:write:personal': 'Personal',
};
const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const DASHBOARD = 'https://fin.neeraj.fyi/mcp/dashboard';

export default function McpConnectionsScreen() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const { tokens } = useTheme();
  const tone = useSettingsToneColor();
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 100 } : 'skip');
  const clients = useQuery(api.mcpOAuth.listMyClients, live ? {} : 'skip');
  const revoke = useMutation(api.mcpOAuth.revokeGrant);
  const removeClient = useMutation(api.mcpOAuth.deleteMyClient);
  const active = grants?.filter((grant) => grant.revokedAt === undefined) ?? [];
  return (
    <SettingsScreen
      title="MCP connections"
      subtitle="AI apps that can use your Finapp"
      onBack={back}
    >
      <SettingsHero
        icon={<PlugZap size={22} color={tokens.primary} />}
        title={`${active.length} active ${active.length === 1 ? 'connection' : 'connections'}`}
        description="Connect ChatGPT, Claude or any MCP client to fin.neeraj.fyi/mcp."
      />
      <SettingsGroup title="Connected apps">
        {grants === undefined ? (
          <SettingsLink title={live ? 'Loading…' : 'Connect to see your apps'} />
        ) : active.length ? (
          active.map((grant) => (
            <SettingsLink
              key={grant.id}
              icon={<Unplug size={19} color={tone('info')} />}
              tone="info"
              title={grant.clientName}
              description={`Since ${when(grant.createdAt)} · ${grant.scopes.map((scope) => SCOPES[scope] ?? scope).join(', ')}`}
              value="Disconnect"
              onPress={() =>
                Alert.alert(`Disconnect ${grant.clientName}?`, 'It loses access right away.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => void revoke({ grantId: grant.id as Id<'mcpOAuthGrants'> }),
                  },
                ])
              }
            />
          ))
        ) : (
          <SettingsLink
            title="No apps connected"
            description="Add Finapp as a connector in ChatGPT or Claude."
          />
        )}
      </SettingsGroup>
      <SettingsGroup title="Set up">
        <SettingsLink
          icon={<ExternalLink size={19} color={tone('primary')} />}
          tone="primary"
          title="MCP dashboard"
          description="Server URL, tools, activity and OAuth setup"
          onPress={() => void Linking.openURL(DASHBOARD)}
        />
      </SettingsGroup>
      <SettingsGroup title="Your client credentials">
        {clients?.length ? (
          clients.map((client) => (
            <SettingsLink
              key={client.clientId}
              icon={<KeySquare size={19} color={tone('warning')} />}
              tone="warning"
              title={client.clientName}
              description={`${client.clientId.slice(0, 12)}… · ${client.tokenEndpointAuthMethod}`}
              value="Delete"
              onPress={() =>
                Alert.alert(`Delete ${client.clientName}?`, 'Apps using it are disconnected.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => void removeClient({ clientId: client.clientId }),
                  },
                ])
              }
            />
          ))
        ) : (
          <SettingsLink
            icon={<KeySquare size={19} color={tone()} />}
            title="Create client credentials"
            description="On the MCP dashboard, for ChatGPT’s “your own credentials”"
            onPress={() => void Linking.openURL(DASHBOARD)}
          />
        )}
      </SettingsGroup>
    </SettingsScreen>
  );
}
