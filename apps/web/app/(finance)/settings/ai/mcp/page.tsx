'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ExternalLink, KeySquare, PlugZap, Unplug } from 'lucide-react';
import { SettingsGroup, SettingsHero, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

const SCOPE_LABELS: Record<string, string> = {
  'finapp:read': 'Read',
  'finapp:write:finance': 'Money',
  'finapp:write:social': 'Social',
  'finapp:write:groups': 'Groups',
  'finapp:write:personal': 'Personal',
};

const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Apps (ChatGPT, Claude, …) connected over MCP: see, revoke, and manage your own clients. */
export default function McpConnectionsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 100 } : 'skip');
  const clients = useQuery(api.mcpOAuth.listMyClients, live ? {} : 'skip');
  const revoke = useMutation(api.mcpOAuth.revokeGrant);
  const removeClient = useMutation(api.mcpOAuth.deleteMyClient);
  const [busy, setBusy] = React.useState<string | null>(null);
  const active = grants?.filter((grant) => grant.revokedAt === undefined) ?? [];
  const past = grants?.filter((grant) => grant.revokedAt !== undefined).slice(0, 10) ?? [];

  const disconnect = async (grantId: string, name: string) => {
    if (!window.confirm(`Disconnect ${name}? It will lose access to your Finapp right away.`))
      return;
    setBusy(grantId);
    try {
      await revoke({ grantId: grantId as Id<'mcpOAuthGrants'> });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsShell
      title="MCP connections"
      subtitle="AI apps that can use your Finapp through the Model Context Protocol"
      onBack={() => router.push('/settings/ai')}
    >
      <SettingsHero
        icon={<PlugZap size={24} />}
        title={`${active.length} active ${active.length === 1 ? 'connection' : 'connections'}`}
        description="Connect ChatGPT, Claude or any MCP client to https://fin.neeraj.fyi/mcp. You approve exactly what each app can do."
      />

      <SettingsGroup title="Connected apps">
        {grants === undefined ? (
          <SettingsLink title="Loading…" />
        ) : active.length ? (
          active.map((grant) => (
            <SettingsLink
              key={grant.id}
              icon={<Unplug size={19} />}
              tone="info"
              title={grant.clientName}
              description={`Since ${when(grant.createdAt)} · ${grant.scopes
                .map((scope) => SCOPE_LABELS[scope] ?? scope)
                .join(', ')}`}
              value={busy === grant.id ? 'Disconnecting…' : 'Disconnect'}
              onPress={() => void disconnect(String(grant.id), grant.clientName)}
            />
          ))
        ) : (
          <SettingsLink
            title="No apps connected"
            description="Add Finapp as a connector in ChatGPT or Claude to get started."
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="Set up" description="Endpoints, OAuth details and activity">
        <SettingsLink
          icon={<ExternalLink size={19} />}
          tone="primary"
          title="MCP dashboard"
          description="Server URL, tool catalogue, activity log and OAuth setup"
          onPress={() => router.push('/mcp/dashboard')}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Your client credentials"
        description="Confidential OAuth clients you created for ChatGPT's “your own credentials” option"
      >
        {clients?.length ? (
          clients.map((client) => (
            <SettingsLink
              key={client.clientId}
              icon={<KeySquare size={19} />}
              tone="warning"
              title={client.clientName}
              description={`${client.clientId.slice(0, 12)}… · ${client.tokenEndpointAuthMethod} · ${when(client.createdAt)}`}
              value="Delete"
              onPress={() => {
                if (window.confirm(`Delete ${client.clientName}? Apps using it are disconnected.`))
                  void removeClient({ clientId: client.clientId });
              }}
            />
          ))
        ) : (
          <SettingsLink
            icon={<KeySquare size={19} />}
            title="Create client credentials"
            description="Only needed if you choose “your own client credentials” in ChatGPT"
            onPress={() => router.push('/mcp/dashboard')}
          />
        )}
      </SettingsGroup>

      {past.length ? (
        <SettingsGroup title="Recently disconnected">
          {past.map((grant) => (
            <SettingsLink
              key={grant.id}
              title={grant.clientName}
              description={`Disconnected ${when(grant.revokedAt!)}`}
            />
          ))}
        </SettingsGroup>
      ) : null}
    </SettingsShell>
  );
}
