'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { ApiScope } from '@convex/publicApi/scopes';
import { SettingsGroup, SettingsLink } from '@finapp/ui/finance';
import { errorText, ScopeChips, ScopePicker, SecretReveal, when } from './shared';
import styles from './developer.module.css';

/** OAuth apps you build (developer side). */
export function AppsSection({ live }: { live: boolean }) {
  const apps = useQuery(api.publicApi.oauthApps.listMyApps, live ? {} : 'skip');
  const createApp = useMutation(api.publicApi.oauthApps.createApp);
  const rotate = useMutation(api.publicApi.oauthApps.rotateAppSecret);
  const remove = useMutation(api.publicApi.oauthApps.deleteApp);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    description: '',
    logoUrl: '',
    homepageUrl: '',
    redirectUris: '',
    clientType: 'confidential' as 'confidential' | 'public',
  });
  const [scopes, setScopes] = React.useState<ApiScope[]>(['profile:read']);
  const [revealed, setRevealed] = React.useState<{ label: string; value: string } | null>(null);
  const [message, setMessage] = React.useState('');
  const set = (key: keyof typeof form) => (event: { currentTarget: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.currentTarget.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const app = await createApp({
        name: form.name,
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
        homepageUrl: form.homepageUrl || undefined,
        redirectUris: form.redirectUris.split(/\s+/).filter(Boolean),
        scopes,
        clientType: form.clientType,
      });
      setCreating(false);
      setRevealed({
        label: `Client ID ${app.clientId}${app.clientSecret ? ' — client secret' : ''}`,
        value: app.clientSecret ?? app.clientId,
      });
    } catch (cause) {
      setMessage(errorText(cause, 'Could not register the app'));
    }
  }

  return (
    <SettingsGroup
      span
      title="Your OAuth apps"
      description="Let other people connect their FinApp to your app with OAuth 2.1 (authorization code + PKCE). You get a client id and, for server-side apps, a secret."
    >
      {revealed ? (
        <SecretReveal
          label={revealed.label}
          value={revealed.value}
          onDone={() => setRevealed(null)}
        />
      ) : null}
      {creating ? (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>App name</span>
            <input value={form.name} maxLength={80} onChange={set('name')} required />
          </label>
          <label className={styles.field}>
            <span>Description (shown on the consent screen)</span>
            <textarea value={form.description} maxLength={300} onChange={set('description')} />
          </label>
          <label className={styles.field}>
            <span>Logo URL (https)</span>
            <input value={form.logoUrl} type="url" onChange={set('logoUrl')} />
          </label>
          <label className={styles.field}>
            <span>Website (https)</span>
            <input value={form.homepageUrl} type="url" onChange={set('homepageUrl')} />
          </label>
          <label className={styles.field}>
            <span>Redirect URIs (one per line; https, or http://localhost for development)</span>
            <textarea value={form.redirectUris} onChange={set('redirectUris')} required />
          </label>
          <label className={styles.field}>
            <span>Client type</span>
            <select value={form.clientType} onChange={set('clientType')}>
              <option value="confidential">Confidential (server-side, has a secret)</option>
              <option value="public">Public (mobile or single-page app, PKCE only)</option>
            </select>
          </label>
          <div className={styles.field}>
            <span>Maximum scopes the app may request</span>
            <ScopePicker value={scopes} onChange={setScopes} />
          </div>
          <div className={styles.row}>
            <button type="submit" className={styles.primary}>
              Register app
            </button>
            <button type="button" className={styles.secondary} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.form}>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              disabled={!live}
              onClick={() => setCreating(true)}
            >
              Register an app
            </button>
          </div>
        </div>
      )}
      {message ? <p className={styles.message}>{message}</p> : null}
      {apps === undefined ? (
        <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to manage apps'} />
      ) : apps.length ? (
        apps.map((app) => (
          <div key={app.id} className={styles.item}>
            <div className={styles.itemHead}>
              <strong>{app.name}</strong>
              <span className={styles.status}>
                {app.clientType} · {app.activeUsers} {app.activeUsers === 1 ? 'user' : 'users'}
              </span>
            </div>
            <p className={styles.meta}>
              Client ID <code>{app.clientId}</code>
              {app.clientSecretPrefix ? (
                <>
                  {' '}
                  · secret <code>{app.clientSecretPrefix}…</code>
                </>
              ) : null}{' '}
              · created {when(app.createdAt)}
            </p>
            <p className={styles.meta}>Redirects: {app.redirectUris.join(', ')}</p>
            <ScopeChips scopes={app.scopes} />
            <div className={styles.row}>
              {app.clientType === 'confidential' ? (
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={async () => {
                    if (!window.confirm('Rotate the client secret? The old one stops working.'))
                      return;
                    try {
                      const result = await rotate({ appId: app.id });
                      setRevealed({ label: 'New client secret', value: result.clientSecret });
                    } catch (cause) {
                      setMessage(errorText(cause, 'Could not rotate the secret'));
                    }
                  }}
                >
                  Rotate secret
                </button>
              ) : null}
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${app.name}? Every user's connection and token for it stops working.`,
                    )
                  )
                    void remove({ appId: app.id });
                }}
              >
                Delete app
              </button>
            </div>
          </div>
        ))
      ) : (
        <SettingsLink title="No apps registered" />
      )}
    </SettingsGroup>
  );
}

/** Apps you've authorized to use your account. */
export function ConnectedAppsSection({ live }: { live: boolean }) {
  const connected = useQuery(api.publicApi.oauthApps.listConnectedApps, live ? {} : 'skip');
  const revoke = useMutation(api.publicApi.oauthApps.revokeConnectedApp);
  return (
    <SettingsGroup
      title="Connected apps"
      description="Third-party apps you allowed to use your FinApp through the API"
    >
      {connected === undefined ? (
        <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to see apps'} />
      ) : connected.length ? (
        connected.map((grant) => (
          <div key={grant.grantId} className={styles.item}>
            <div className={styles.itemHead}>
              <strong>{grant.appName}</strong>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  if (window.confirm(`Disconnect ${grant.appName}? It loses access right away.`))
                    void revoke({ grantId: grant.grantId });
                }}
              >
                Disconnect
              </button>
            </div>
            <p className={styles.meta}>
              Since {when(grant.createdAt)} · last used {when(grant.lastUsedAt)}
            </p>
            <ScopeChips scopes={grant.scopes} />
          </div>
        ))
      ) : (
        <SettingsLink title="No apps connected" />
      )}
    </SettingsGroup>
  );
}
