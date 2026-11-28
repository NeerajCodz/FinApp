import React from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  ExternalLink,
  Eye,
  KeySquare,
  PlugZap,
  Power,
  ShieldAlert,
  SlidersHorizontal,
  Unplug,
} from 'lucide-react-native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsLink,
  SettingsScreen,
  SettingsSwitch,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import {
  createScopeUpdateState,
  queueScopeUpdate,
  syncScopeUpdateFromServer,
} from '@finapp/mcp/scopeUpdates';
import type { ScopeUpdateState } from '@finapp/mcp/scopeUpdates';

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
  const stored = useQuery(api.mcpOAuth.getSettings, live ? {} : 'skip');
  const updateSettings = useMutation(api.mcpOAuth.updateSettings);
  const updateScopes = useMutation(api.mcpOAuth.updateGrantScopes);
  const scopeUpdates = React.useRef(new Map<string, ScopeUpdateState>());
  const [settings, setSettings] = React.useState(stored);
  const [open, setOpen] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (stored) setSettings(stored);
  }, [stored]);
  React.useEffect(() => {
    for (const grant of grants ?? []) {
      const update = scopeUpdates.current.get(String(grant.id));
      if (update) syncScopeUpdateFromServer(update, grant.scopes);
    }
  }, [grants]);
  const save = async (patch: {
    enabled?: boolean;
    readOnly?: boolean;
    allowDestructive?: boolean;
  }) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    try {
      await updateSettings(patch);
    } catch {
      setSettings(previous);
    }
  };
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
      <SettingsGroup title="Access control">
        <SettingsSwitch
          icon={<Power size={19} color={tone('primary')} />}
          tone="primary"
          title="Allow AI apps"
          description="Off blocks every connected app at once"
          checked={settings?.enabled ?? true}
          disabled={!live || !settings}
          onChange={(enabled) => void save({ enabled })}
        />
        <SettingsSwitch
          icon={<Eye size={19} color={tone('info')} />}
          tone="info"
          title="Read-only mode"
          description="Apps can look but not change anything"
          checked={settings?.readOnly ?? false}
          disabled={!live || !settings?.enabled}
          onChange={(readOnly) => void save({ readOnly })}
        />
        <SettingsSwitch
          icon={<ShieldAlert size={19} color={tone('warning')} />}
          tone="warning"
          title="Allow deletes"
          description="Delete tools always need your confirmation"
          checked={settings?.allowDestructive ?? true}
          disabled={!live || !settings?.enabled || settings?.readOnly}
          onChange={(allowDestructive) => void save({ allowDestructive })}
        />
        <SettingsLink
          icon={<SlidersHorizontal size={19} color={tone()} />}
          title="Block individual tools"
          description={`${settings?.blockedTools.length ?? 0} blocked · manage on the web`}
          onPress={() => void Linking.openURL('https://fin.neeraj.fyi/settings/ai/mcp')}
        />
      </SettingsGroup>
      <SettingsGroup title="Connected apps">
        {grants === undefined ? (
          <SettingsLink title={live ? 'Loading…' : 'Connect to see your apps'} />
        ) : active.length ? (
          active.map((grant) => {
            const expanded = open === String(grant.id);
            return (
              <React.Fragment key={grant.id}>
                <SettingsLink
                  icon={<Unplug size={19} color={tone('info')} />}
                  tone="info"
                  title={grant.clientName}
                  description={`Since ${when(grant.createdAt)} · ${grant.scopes.map((scope) => SCOPES[scope] ?? scope).join(', ')}`}
                  value={expanded ? 'Close' : 'Manage'}
                  onPress={() => setOpen(expanded ? null : String(grant.id))}
                />
                {expanded
                  ? [
                      ...(
                        [
                          'finapp:write:finance',
                          'finapp:write:groups',
                          'finapp:write:social',
                          'finapp:write:personal',
                        ] as const
                      ).map((scope) => (
                        <SettingsSwitch
                          key={scope}
                          title={`Change ${SCOPES[scope]!.toLowerCase()}`}
                          checked={grant.scopes.includes(scope)}
                          disabled={!live}
                          onChange={(next) => {
                            const grantId = String(grant.id);
                            let update = scopeUpdates.current.get(grantId);
                            if (!update) {
                              update = createScopeUpdateState(grant.scopes);
                              scopeUpdates.current.set(grantId, update);
                            }
                            void queueScopeUpdate(update, scope, next, (scopes) =>
                              updateScopes({
                                grantId: grant.id as Id<'mcpOAuthGrants'>,
                                scopes,
                              }),
                            ).catch(() => {});
                          }}
                        />
                      )),
                      <SettingsLink
                        key="disconnect"
                        danger
                        title={`Disconnect ${grant.clientName}`}
                        onPress={() =>
                          Alert.alert(
                            `Disconnect ${grant.clientName}?`,
                            'It loses access right away.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Disconnect',
                                style: 'destructive',
                                onPress: () =>
                                  void revoke({ grantId: grant.id as Id<'mcpOAuthGrants'> }),
                              },
                            ],
                          )
                        }
                      />,
                    ]
                  : null}
              </React.Fragment>
            );
          })
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
