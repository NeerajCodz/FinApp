'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import styles from './ClientCredentials.module.css';

const CHATGPT_REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

type Created = {
  clientId: string;
  clientSecret: string;
  tokenEndpointAuthMethod: string;
  redirectUris: string[];
};

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <div className={styles.copyRow}>
        <code data-secret={secret || undefined}>{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/**
 * Connection details for any MCP client, plus "your own client credentials": confidential OAuth
 * clients you create here and paste into ChatGPT's app settings. ChatGPT can also register itself
 * (Dynamic Client Registration) or use its hosted client document (CIMD); no setup needed.
 */
export function ClientCredentials({ origin, endpoint }: { origin: string; endpoint: string }) {
  const clients = useQuery(api.mcpOAuth.listMyClients, {});
  const createClient = useMutation(api.mcpOAuth.createStaticClient);
  const deleteClient = useMutation(api.mcpOAuth.deleteMyClient);
  const [name, setName] = useState('ChatGPT');
  const [redirects, setRedirects] = useState(CHATGPT_REDIRECT);
  const [method, setMethod] = useState<'client_secret_basic' | 'client_secret_post'>(
    'client_secret_basic',
  );
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await createClient({
        clientName: name.trim() || 'MCP client',
        redirectUris: redirects
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter(Boolean),
        tokenEndpointAuthMethod: method,
      });
      setCreated(result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        message.includes('INVALID_REDIRECT_URI')
          ? 'Redirect URIs must be HTTPS (or http://localhost).'
          : message.includes('TOO_MANY_CLIENTS')
            ? 'You already have 20 clients. Delete one first.'
            : 'Could not create the client. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="mcp-oauth-setup">
      <header>
        <p className={styles.eyebrow}>CONNECT AN AI APP</p>
        <h2 id="mcp-oauth-setup">OAuth setup</h2>
        <p className={styles.muted}>
          Finapp supports every registration method. In ChatGPT, choose{' '}
          <strong>Dynamic Client Registration</strong> or <strong>CIMD</strong> and nothing else is
          needed. To use <strong>your own client credentials</strong>, create a client below.
        </p>
      </header>

      <div className={styles.grid}>
        <CopyField label="MCP server URL" value={endpoint} />
        <CopyField label="Authorization URL" value={`${origin}/oauth/authorize`} />
        <CopyField label="Token URL" value={`${origin}/oauth/token`} />
        <CopyField label="Registration URL" value={`${origin}/oauth/register`} />
        <CopyField label="Authorization server" value={origin} />
        <CopyField
          label="Scopes"
          value="finapp:read finapp:write:finance finapp:write:social finapp:write:groups finapp:write:personal"
        />
      </div>

      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <h3>Create client credentials</h3>
        <label>
          <span>Name</span>
          <input value={name} maxLength={128} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
        <label>
          <span>Redirect URIs (one per line)</span>
          <textarea
            rows={2}
            value={redirects}
            onChange={(e) => setRedirects(e.currentTarget.value)}
          />
          <small>
            Use the exact callback shown in ChatGPT&apos;s app settings. The stable one is
            prefilled.
          </small>
        </label>
        <label>
          <span>Token endpoint auth method</span>
          <select
            value={method}
            onChange={(e) =>
              setMethod(e.currentTarget.value as 'client_secret_basic' | 'client_secret_post')
            }
          >
            <option value="client_secret_basic">client_secret_basic</option>
            <option value="client_secret_post">client_secret_post</option>
          </select>
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Creating…' : 'Create client'}
        </button>
      </form>

      {created ? (
        <div className={styles.created} role="status">
          <h3>Copy these now</h3>
          <p className={styles.muted}>The secret is shown once. Store it in ChatGPT now.</p>
          <CopyField label="Client ID" value={created.clientId} />
          <CopyField label="Client secret" value={created.clientSecret} secret />
          <CopyField label="Token endpoint auth method" value={created.tokenEndpointAuthMethod} />
        </div>
      ) : null}

      {clients?.length ? (
        <div className={styles.list}>
          <h3>Your clients</h3>
          <ul>
            {clients.map((client) => (
              <li key={client.clientId}>
                <div>
                  <strong>{client.clientName}</strong>
                  <small>
                    {client.clientId.slice(0, 12)}… · {client.tokenEndpointAuthMethod}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${client.clientName}? Apps connected with it will be disconnected.`,
                      )
                    )
                      void deleteClient({ clientId: client.clientId });
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
