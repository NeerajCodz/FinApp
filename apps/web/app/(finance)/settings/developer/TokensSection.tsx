'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { ApiScope } from '@convex/publicApi/scopes';
import { SettingsGroup, SettingsLink } from '@finapp/ui/finance';
import { errorText, ScopeChips, ScopePicker, SecretReveal, when } from './shared';
import styles from './developer.module.css';

type Expiry = 'never' | '7d' | '30d' | '90d' | 'custom';

export function TokensSection({ live }: { live: boolean }) {
  const list = useQuery(api.pats.queries.list, live ? {} : 'skip');
  const create = useMutation(api.pats.mutations.create);
  const revoke = useMutation(api.pats.mutations.revoke);
  const regenerate = useMutation(api.pats.mutations.regenerate);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState<ApiScope[]>(['profile:read']);
  const [expiry, setExpiry] = React.useState<Expiry>('30d');
  const [customDate, setCustomDate] = React.useState('');
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const active = list?.tokens.filter((token) => token.status === 'active') ?? [];
  const inactive = list?.tokens.filter((token) => token.status !== 'active').slice(0, 10) ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !scopes.length) return setMessage('Add a name and at least one scope.');
    setBusy(true);
    setMessage('');
    try {
      const result = await create({
        name,
        scopes,
        expiry:
          expiry === 'custom'
            ? { customAt: new Date(`${customDate}T23:59:59`).getTime() }
            : { preset: expiry },
      });
      setRevealed(result.token);
      setCreating(false);
      setName('');
      setScopes(['profile:read']);
    } catch (cause) {
      setMessage(errorText(cause, 'Could not create the token'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsGroup
      span
      title="Personal access tokens"
      description={`Use a token as "Authorization: Bearer fa_pat_…" to call the API as yourself. Up to ${list?.limit ?? 25} active tokens.`}
    >
      {revealed ? (
        <SecretReveal label="Your new token" value={revealed} onDone={() => setRevealed(null)} />
      ) : null}
      {creating ? (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              value={name}
              maxLength={80}
              placeholder="e.g. Spreadsheet sync"
              onChange={(event) => setName(event.currentTarget.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Expires</span>
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.currentTarget.value as Expiry)}
            >
              <option value="7d">In 7 days</option>
              <option value="30d">In 30 days</option>
              <option value="90d">In 90 days</option>
              <option value="custom">On a date…</option>
              <option value="never">Never</option>
            </select>
          </label>
          {expiry === 'custom' ? (
            <label className={styles.field}>
              <span>Expiry date (up to a year)</span>
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.currentTarget.value)}
                required
              />
            </label>
          ) : null}
          <div className={styles.field}>
            <span>Scopes</span>
            <ScopePicker value={scopes} onChange={setScopes} />
          </div>
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? 'Creating…' : 'Create token'}
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
              New token
            </button>
          </div>
        </div>
      )}
      {message ? <p className={styles.message}>{message}</p> : null}
      {list === undefined ? (
        <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to manage tokens'} />
      ) : active.length ? (
        active.map((token) => (
          <div key={token.id} className={styles.item}>
            <div className={styles.itemHead}>
              <strong>{token.name}</strong>
              <span className={styles.status} data-tone="positive">
                Active
              </span>
            </div>
            <p className={styles.meta}>
              <code>{token.tokenPrefix}…</code> · created {when(token.createdAt)} · expires{' '}
              {token.expiresAt ? when(token.expiresAt) : 'never'} · last used{' '}
              {token.lastUsedAt
                ? `${when(token.lastUsedAt)}${token.lastUsedIpFingerprint ? ` (from ${token.lastUsedIpFingerprint})` : ''}`
                : 'never'}
            </p>
            <ScopeChips scopes={token.scopes} />
            <div className={styles.row}>
              <button
                type="button"
                className={styles.ghost}
                onClick={async () => {
                  if (
                    !window.confirm(`Regenerate "${token.name}"? The current value stops working.`)
                  )
                    return;
                  try {
                    setRevealed((await regenerate({ tokenId: token.id })).token);
                  } catch (cause) {
                    setMessage(errorText(cause, 'Could not regenerate the token'));
                  }
                }}
              >
                Regenerate
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  if (window.confirm(`Revoke "${token.name}"? Apps using it lose access now.`))
                    void revoke({ tokenId: token.id });
                }}
              >
                Revoke
              </button>
            </div>
          </div>
        ))
      ) : (
        <SettingsLink title="No active tokens" description="Create one to start using the API." />
      )}
      {inactive.length ? (
        <details className={styles.item}>
          <summary className={styles.meta}>Revoked and expired ({inactive.length})</summary>
          {inactive.map((token) => (
            <p key={token.id} className={styles.meta}>
              {token.name} · <code>{token.tokenPrefix}…</code> · {token.status}
            </p>
          ))}
        </details>
      ) : null}
    </SettingsGroup>
  );
}
