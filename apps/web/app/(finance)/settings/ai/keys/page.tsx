'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { AI_PROVIDER_IDS, AI_PROVIDERS, type AiProviderId } from '@convex/shared/aiProviders';
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { SettingsGroup, SettingsHero, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import styles from './keys.module.css';

const errorCopy: Record<string, string> = {
  AI_KEY_INVALID: 'The provider rejected this key. Check it and try again.',
  INVALID_KEY: 'Paste the whole key, without spaces.',
  INVALID_MODEL: 'Enter a model id.',
  INVALID_BASE_URL: 'Enter an HTTPS base URL, e.g. https://api.example.com/v1',
  TOO_MANY_KEYS: 'You can save up to 10 keys. Remove one first.',
  AI_KEYS_NOT_CONFIGURED: 'Key storage isn’t set up on this server yet.',
  UNKNOWN_PROVIDER: 'Choose a provider.',
};
const messageFor = (cause: unknown) => {
  const raw = cause instanceof Error ? cause.message : '';
  const code = Object.keys(errorCopy).find((key) => raw.includes(key));
  return code ? errorCopy[code]! : 'Couldn’t save the key. Try again.';
};

/** Bring your own key: FinAI runs on your OpenAI, Anthropic, Gemini, OpenRouter… account. */
export default function ApiKeysPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const data = useQuery(api.ai.keys.list, live ? {} : 'skip');
  const addKey = useAction(api.ai.keys.add);
  const testKey = useAction(api.ai.keys.test);
  const setActive = useMutation(api.ai.keys.setActive);
  const removeKey = useMutation(api.ai.keys.remove);

  const [provider, setProvider] = React.useState<AiProviderId>('openai');
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState(AI_PROVIDERS.openai.models[0] ?? '');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [testing, setTesting] = React.useState<string | null>(null);
  const info = AI_PROVIDERS[provider];
  const keys = data?.keys ?? [];
  const activeKey = keys.find((key) => key.active);

  const pickProvider = (next: AiProviderId) => {
    setProvider(next);
    setModel(AI_PROVIDERS[next].models[0] ?? '');
    setBaseUrl('');
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await addKey({
        provider,
        apiKey,
        model,
        ...(label.trim() ? { label } : {}),
        ...(baseUrl.trim() ? { baseUrl } : {}),
        makeActive: true,
      });
      setApiKey('');
      setLabel('');
      setNotice(
        result.status === 'ok'
          ? 'Key saved and checked. FinAI now uses it.'
          : 'Key saved, but the provider couldn’t be reached to check it. FinAI will use it.',
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsShell
      title="API keys"
      subtitle="Run FinAI on your own model provider account"
      onBack={() => router.push('/settings/ai')}
      wide
    >
      <SettingsHero
        icon={<Sparkles size={24} />}
        title={activeKey ? `FinAI uses ${activeKey.label}` : 'FinAI uses Finapp’s built-in model'}
        description="Keys are encrypted on the server and never shown again. Usage is billed by your provider. Tools, cards and confirmations work the same on every model."
        action={
          activeKey ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void setActive({ keyId: null })}
            >
              Use built-in model
            </button>
          ) : undefined
        }
      />

      <SettingsGroup title="Your keys">
        {data === undefined ? (
          <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to manage keys'} />
        ) : keys.length ? (
          keys.map((key) => (
            <div key={key.id} className={styles.keyRow}>
              <span className={styles.keyIcon} data-status={key.status} aria-hidden>
                {key.status === 'ok' ? (
                  <CheckCircle2 size={18} />
                ) : key.status === 'invalid' ? (
                  <CircleAlert size={18} />
                ) : (
                  <KeyRound size={18} />
                )}
              </span>
              <div className={styles.keyText}>
                <strong>
                  {key.label}
                  {key.active ? <em>Active</em> : null}
                </strong>
                <small>
                  {AI_PROVIDERS[key.provider]?.label ?? key.provider} · {key.model} · {key.keyHint}
                  {key.status === 'invalid'
                    ? ' · Rejected'
                    : key.status === 'unreachable'
                      ? ' · Not checked'
                      : ''}
                </small>
              </div>
              <div className={styles.keyActions}>
                {!key.active ? (
                  <button type="button" onClick={() => void setActive({ keyId: key.id })}>
                    Use
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Check ${key.label}`}
                  title="Check key"
                  disabled={testing === key.id}
                  onClick={async () => {
                    setTesting(key.id);
                    try {
                      const status = await testKey({ keyId: key.id as Id<'aiProviderKeys'> });
                      setNotice(
                        status === 'ok'
                          ? `${key.label} works.`
                          : status === 'invalid'
                            ? `${key.label} was rejected.`
                            : `Couldn’t reach ${AI_PROVIDERS[key.provider]?.label}.`,
                      );
                    } finally {
                      setTesting(null);
                    }
                  }}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${key.label}`}
                  title="Remove"
                  data-danger
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${key.label}? FinAI switches back to the built-in model if it was active.`,
                      )
                    )
                      void removeKey({ keyId: key.id });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <SettingsLink
            title="No keys yet"
            description="Add one below to run FinAI on your own account."
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="Add a key">
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.providers} role="radiogroup" aria-label="Provider">
            {AI_PROVIDER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={provider === id}
                data-active={provider === id || undefined}
                onClick={() => pickProvider(id)}
              >
                {AI_PROVIDERS[id].label}
              </button>
            ))}
          </div>
          <label>
            <span>API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              placeholder={info.keyPrefix ? `${info.keyPrefix}…` : 'Paste your key'}
              onChange={(event) => setApiKey(event.currentTarget.value)}
              required
            />
            {info.keyUrl ? (
              <small>
                Create one at{' '}
                <a href={info.keyUrl} target="_blank" rel="noreferrer">
                  {new URL(info.keyUrl).hostname}
                </a>
              </small>
            ) : null}
          </label>
          <label>
            <span>Model</span>
            <input
              list="byok-models"
              value={model}
              placeholder="Model id"
              onChange={(event) => setModel(event.currentTarget.value)}
              required
            />
            <datalist id="byok-models">
              {info.models.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <small>
              Pick a suggestion or type any model your account can use (it must support tool
              calling).
            </small>
          </label>
          {provider === 'custom' || provider === 'openrouter' ? (
            <label>
              <span>Base URL{provider === 'custom' ? '' : ' (optional)'}</span>
              <input
                type="url"
                value={baseUrl}
                placeholder={info.baseUrl || 'https://api.example.com/v1'}
                onChange={(event) => setBaseUrl(event.currentTarget.value)}
                required={provider === 'custom'}
              />
            </label>
          ) : null}
          <label>
            <span>Name (optional)</span>
            <input
              value={label}
              maxLength={60}
              placeholder={`${info.label} · ${model || 'model'}`}
              onChange={(event) => setLabel(event.currentTarget.value)}
            />
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.primary}
            disabled={busy || !live || data?.vault === false}
          >
            <Plus size={16} /> {busy ? 'Checking key…' : 'Save and use'}
          </button>
          {data?.vault === false ? (
            <small className={styles.notice}>
              Key storage isn’t configured on this server yet.
            </small>
          ) : null}
        </form>
      </SettingsGroup>
    </SettingsShell>
  );
}
