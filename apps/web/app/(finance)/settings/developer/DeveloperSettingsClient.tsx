'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { Terminal } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { SettingsGroup, SettingsHero, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { AppsSection, ConnectedAppsSection } from './AppsSection';
import { TokensSection } from './TokensSection';
import { WebhooksSection } from './WebhooksSection';
import { when } from './shared';
import styles from './developer.module.css';

const KIND_LABEL: Record<string, string> = {
  'api.request': 'API request',
  'api.rate_limited': 'Rate limited',
  'token.created': 'Token created',
  'token.regenerated': 'Token regenerated',
  'token.revoked': 'Token revoked',
  'app.created': 'App registered',
  'app.deleted': 'App deleted',
  'app.secret_rotated': 'App secret rotated',
  'app.authorized': 'App connected',
  'app.revoked': 'App disconnected',
  'app.refresh_reuse_revoked': 'App disconnected (token reuse)',
  'webhook.created': 'Webhook added',
  'webhook.deleted': 'Webhook deleted',
  'webhook.secret_rotated': 'Webhook secret rotated',
  'webhook.disabled': 'Webhook paused',
};

function ActivitySection({ live }: { live: boolean }) {
  const events = useQuery(api.publicApi.audit.list, live ? { limit: 50 } : 'skip');
  return (
    <SettingsGroup
      span
      title="Activity"
      description="Token, app and webhook usage from the last 30 days. Only metadata is kept: no request bodies, tokens or IP addresses."
    >
      {events === undefined ? (
        <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to see activity'} />
      ) : events.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>By</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{when(event.createdAt)}</td>
                  <td>{KIND_LABEL[event.kind] ?? event.kind}</td>
                  <td>
                    {event.label ?? '—'}
                    {event.actorType !== 'user'
                      ? ` (${event.actorType === 'pat' ? 'token' : 'app'})`
                      : ''}
                  </td>
                  <td>
                    {event.method ? (
                      <code>
                        {event.method} {event.route}
                      </code>
                    ) : null}
                    {event.status ? ` · ${event.status}` : ''}
                    {event.ipFingerprint ? ` · ${event.ipFingerprint}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SettingsLink title="No activity yet" />
      )}
    </SettingsGroup>
  );
}

/** Settings → Developer: tokens, OAuth apps, connected apps, webhooks and API activity. */
export function DeveloperSettingsClient({ docsUrl }: { docsUrl: string }) {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  if (!userId)
    return (
      <FinanceSignedOut
        section="DEVELOPER"
        title="Build on FinApp."
        description="Sign in to create access tokens, register apps and add webhooks."
      />
    );
  return (
    <SettingsShell
      title="API & developer"
      subtitle="Connect your own tools and apps to FinApp"
      onBack={() => router.push('/settings')}
      wide
    >
      <SettingsHero
        icon={<Terminal size={24} />}
        title="The FinApp API"
        description="A REST API at /api/v1 with scoped tokens, OAuth for third-party apps and signed webhooks. Every request runs the same checks as the app."
        action={
          <a className={styles.primary} href={docsUrl} target="_blank" rel="noreferrer">
            Read the docs
          </a>
        }
      />
      <TokensSection live={live} />
      <ConnectedAppsSection live={live} />
      <WebhooksSection live={live} />
      <AppsSection live={live} />
      <ActivitySection live={live} />
    </SettingsShell>
  );
}
