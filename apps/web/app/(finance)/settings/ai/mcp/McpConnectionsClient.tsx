'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  ChevronDown,
  ExternalLink,
  Eye,
  KeySquare,
  LayoutDashboard,
  PlugZap,
  Power,
  Search,
  ShieldAlert,
  Unplug,
} from 'lucide-react';
import {
  SettingsGroup,
  SettingsHero,
  SettingsLink,
  SettingsShell,
  SettingsSwitch,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  createScopeUpdateState,
  queueScopeUpdate,
  syncScopeUpdateFromServer,
} from '@finapp/mcp/scopeUpdates';
import type { ScopeUpdateState } from '@finapp/mcp/scopeUpdates';
import styles from './mcp.module.css';

export type McpToolSummary = {
  name: string;
  title: string;
  domain: string;
  readOnly: boolean;
  destructive: boolean;
};

const SCOPES = [
  {
    scope: 'finapp:write:finance',
    label: 'Money',
    note: 'Transactions, accounts, categories, goals',
  },
  { scope: 'finapp:write:groups', label: 'Groups', note: 'Shared expenses, settlements, members' },
  { scope: 'finapp:write:social', label: 'Social', note: 'Friends and messages' },
  { scope: 'finapp:write:personal', label: 'Personal', note: 'Profile, privacy, notifications' },
] as const;
const SCOPE_LABEL: Record<string, string> = {
  'finapp:read': 'Read',
  ...Object.fromEntries(SCOPES.map((item) => [item.scope, item.label])),
};
const DOMAIN_LABEL: Record<string, string> = {
  finance: 'Money',
  groups: 'Groups',
  social: 'Social',
  personal: 'Personal',
};

const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** MCP: connected apps, their permissions, access control, tool blocks and client credentials. */
export function McpConnectionsClient({ tools }: { tools: readonly McpToolSummary[] }) {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 100 } : 'skip');
  const clients = useQuery(api.mcpOAuth.listMyClients, live ? {} : 'skip');
  const stored = useQuery(api.mcpOAuth.getSettings, live ? {} : 'skip');
  const revoke = useMutation(api.mcpOAuth.revokeGrant);
  const removeClient = useMutation(api.mcpOAuth.deleteMyClient);
  const updateSettings = useMutation(api.mcpOAuth.updateSettings);
  const updateScopes = useMutation(api.mcpOAuth.updateGrantScopes);
  const scopeUpdates = React.useRef(new Map<string, ScopeUpdateState>());
  const [settings, setSettings] = React.useState(stored);
  const [open, setOpen] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (stored) setSettings(stored);
  }, [stored]);
  React.useEffect(() => {
    for (const grant of grants ?? []) {
      const update = scopeUpdates.current.get(String(grant.id));
      if (update) syncScopeUpdateFromServer(update, grant.scopes);
    }
  }, [grants]);
  const active = grants?.filter((grant) => grant.revokedAt === undefined) ?? [];
  const past = grants?.filter((grant) => grant.revokedAt !== undefined).slice(0, 10) ?? [];
  const disabled = !live || !settings;
  const blocked = new Set(settings?.blockedTools ?? []);

  const save = async (patch: Partial<NonNullable<typeof settings>>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    try {
      await updateSettings({
        ...patch,
        ...(patch.blockedTools ? { blockedTools: [...patch.blockedTools] } : {}),
      });
    } catch {
      setSettings(previous);
      setMessage('Could not save. Try again.');
    }
  };
  const toggleTool = (name: string, allow: boolean) => {
    const next = new Set(blocked);
    if (allow) next.delete(name);
    else next.add(name);
    void save({ blockedTools: [...next] });
  };
  const visibleTools = tools.filter(
    (tool) =>
      !query.trim() ||
      `${tool.title} ${tool.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const byDomain = visibleTools.reduce<Record<string, McpToolSummary[]>>((acc, tool) => {
    (acc[tool.domain] ??= []).push(tool);
    return acc;
  }, {});

  return (
    <SettingsShell
      title="MCP connections"
      subtitle="AI apps that can use your Finapp, and exactly what they’re allowed to do"
      onBack={() => router.push('/settings/ai')}
      wide
    >
      <SettingsHero
        icon={<PlugZap size={24} />}
        title={
          settings && !settings.enabled
            ? 'MCP access is off'
            : `${active.length} active ${active.length === 1 ? 'connection' : 'connections'}`
        }
        description="Connect ChatGPT, Claude or any MCP client to https://fin.neeraj.fyi/mcp. Changes here apply on the app’s next request."
        action={
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push('/mcp/dashboard')}
          >
            <LayoutDashboard size={16} aria-hidden /> MCP dashboard
          </button>
        }
      />

      <SettingsGroup title="Access control">
        <SettingsSwitch
          icon={<Power size={19} />}
          tone="primary"
          title="Allow AI apps"
          description="Turn off to block every connected app at once without disconnecting them."
          checked={settings?.enabled ?? true}
          disabled={disabled}
          onChange={(enabled) => void save({ enabled })}
        />
        <SettingsSwitch
          icon={<Eye size={19} />}
          tone="info"
          title="Read-only mode"
          description="Apps can look but not change anything."
          checked={settings?.readOnly ?? false}
          disabled={disabled || !settings?.enabled}
          onChange={(readOnly) => void save({ readOnly })}
        />
        <SettingsSwitch
          icon={<ShieldAlert size={19} />}
          tone="warning"
          title="Allow deletes"
          description="Delete, remove and archive tools. They always need your confirmation in the app."
          checked={settings?.allowDestructive ?? true}
          disabled={disabled || !settings?.enabled || settings?.readOnly}
          onChange={(allowDestructive) => void save({ allowDestructive })}
        />
      </SettingsGroup>

      <SettingsGroup title="Connected apps" description="Tap an app to change its permissions">
        {grants === undefined ? (
          <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to manage apps'} />
        ) : active.length ? (
          active.map((grant) => {
            const expanded = open === String(grant.id);
            return (
              <div key={grant.id} className={styles.grant}>
                <button
                  type="button"
                  className={styles.grantHead}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : String(grant.id))}
                >
                  <span className={styles.grantIcon} aria-hidden>
                    <Unplug size={18} />
                  </span>
                  <span className={styles.grantText}>
                    <strong>{grant.clientName}</strong>
                    <small>
                      Since {when(grant.createdAt)} ·{' '}
                      {grant.scopes.map((scope) => SCOPE_LABEL[scope] ?? scope).join(', ')}
                    </small>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    data-open={expanded || undefined}
                    className={styles.chevron}
                  />
                </button>
                {expanded ? (
                  <div className={styles.grantBody}>
                    <p className={styles.note}>Read access is always included.</p>
                    {SCOPES.map((item) => {
                      const on = grant.scopes.includes(item.scope);
                      return (
                        <SettingsSwitch
                          key={item.scope}
                          title={`Change ${item.label.toLowerCase()}`}
                          description={item.note}
                          checked={on}
                          disabled={!live}
                          onChange={async (next) => {
                            const grantId = String(grant.id);
                            let update = scopeUpdates.current.get(grantId);
                            if (!update) {
                              update = createScopeUpdateState(grant.scopes);
                              scopeUpdates.current.set(grantId, update);
                            }
                            try {
                              await queueScopeUpdate(update, item.scope, next, (scopes) =>
                                updateScopes({
                                  grantId: grant.id as Id<'mcpOAuthGrants'>,
                                  scopes,
                                }),
                              );
                            } catch {
                              setMessage('Could not update permissions.');
                            }
                          }}
                        />
                      );
                    })}
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Disconnect ${grant.clientName}? It loses access right away.`,
                          )
                        )
                          void revoke({ grantId: grant.id as Id<'mcpOAuthGrants'> });
                      }}
                    >
                      Disconnect {grant.clientName}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <SettingsLink
            title="No apps connected"
            description="Add Finapp as a connector in ChatGPT or Claude to get started."
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        span
        title="Tool access"
        description={`${tools.length - blocked.size} of ${tools.length} tools available. Blocked tools are hidden from every app.`}
      >
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search tools"
              aria-label="Search tools"
            />
          </label>
          <button
            type="button"
            className={styles.secondary}
            disabled={disabled || blocked.size === 0}
            onClick={() => void save({ blockedTools: [] })}
          >
            Allow all
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={disabled}
            onClick={() =>
              void save({
                blockedTools: [
                  ...new Set([
                    ...blocked,
                    ...tools.filter((tool) => tool.destructive).map((tool) => tool.name),
                  ]),
                ],
              })
            }
          >
            Block all deletes
          </button>
        </div>
        {Object.entries(byDomain).map(([domain, list]) => (
          <details key={domain} className={styles.domain} open={Boolean(query.trim())}>
            <summary>
              <strong>{DOMAIN_LABEL[domain] ?? domain}</strong>
              <small>
                {list.filter((tool) => !blocked.has(tool.name)).length}/{list.length} allowed
              </small>
            </summary>
            <ul className={styles.tools}>
              {list.map((tool) => {
                const allowed = !blocked.has(tool.name);
                return (
                  <li key={tool.name}>
                    <label>
                      <input
                        type="checkbox"
                        checked={allowed}
                        disabled={disabled}
                        onChange={(event) => toggleTool(tool.name, event.currentTarget.checked)}
                      />
                      <span className={styles.toolText}>
                        <strong>{tool.title}</strong>
                        <code>{tool.name}</code>
                      </span>
                      <span className={styles.badges}>
                        {tool.readOnly ? <em>Read</em> : <em data-tone="write">Write</em>}
                        {tool.destructive ? <em data-tone="danger">Delete</em> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Set up">
        <SettingsLink
          icon={<LayoutDashboard size={19} />}
          tone="primary"
          title="MCP dashboard"
          description="Server URL, tool catalogue, widgets, activity log and OAuth setup"
          onPress={() => router.push('/mcp/dashboard')}
        />
        <SettingsLink
          icon={<ExternalLink size={19} />}
          tone="info"
          title="OAuth setup"
          description="Endpoints and registration methods for ChatGPT and other clients"
          onPress={() => router.push('/mcp/dashboard#mcp-oauth-setup')}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Your client credentials"
        description="For ChatGPT’s “your own client credentials” option"
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
            description="On the MCP dashboard, under OAuth setup"
            onPress={() => router.push('/mcp/dashboard#mcp-oauth-setup')}
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

      {message ? (
        <p role="status" className={styles.note} data-span>
          {message}
        </p>
      ) : null}
    </SettingsShell>
  );
}
