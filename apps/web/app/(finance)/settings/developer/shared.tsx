'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { SCOPE_GROUPS, type ApiScope } from '@convex/publicApi/scopes';
import styles from './developer.module.css';

export const when = (at: number | undefined) =>
  at === undefined
    ? '—'
    : new Date(at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

/** Readable error from a Convex mutation failure (codes like TOO_MANY_TOKENS). */
export function errorText(cause: unknown, fallback: string) {
  const data = (cause as { data?: { message?: string } })?.data;
  if (data?.message) return data.message;
  const code = cause instanceof Error ? /\b([A-Z][A-Z_]{3,})\b/.exec(cause.message)?.[1] : null;
  return code ? `${fallback} (${code.toLowerCase().replace(/_/g, ' ')})` : fallback;
}

/** Shows a secret exactly once with a copy button. */
export function SecretReveal({
  label,
  value,
  onDone,
}: {
  label: string;
  value: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className={styles.secret} role="status">
      <strong>{label}</strong>
      <code>{value}</code>
      <p className={styles.note}>
        Copy it now. It is shown only once and FinApp stores only a hash of it.
      </p>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className={styles.secondary} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

/** Read/write checkboxes per resource. Write implies read, so checking write checks read. */
export function ScopePicker({
  value,
  onChange,
  allowed,
}: {
  value: ApiScope[];
  onChange: (next: ApiScope[]) => void;
  allowed?: readonly string[];
}) {
  const toggle = (scope: ApiScope, on: boolean) => {
    const next = new Set(value);
    if (on) {
      next.add(scope);
      if (scope.endsWith(':write')) next.add(scope.replace(':write', ':read') as ApiScope);
    } else {
      next.delete(scope);
      if (scope.endsWith(':read')) next.delete(scope.replace(':read', ':write') as ApiScope);
    }
    onChange([...next]);
  };
  return (
    <div className={styles.scopes}>
      {SCOPE_GROUPS.map((group) => {
        const scopes = group.scopes.filter((scope) => !allowed || allowed.includes(scope));
        if (!scopes.length) return null;
        return (
          <fieldset key={group.resource} className={styles.scope}>
            <strong>{group.label}</strong>
            {scopes.map((scope) => (
              <label key={scope}>
                <input
                  type="checkbox"
                  checked={value.includes(scope)}
                  onChange={(event) => toggle(scope, event.currentTarget.checked)}
                />
                {scope.split(':')[1] === 'manage' ? 'Manage' : capital(scope.split(':')[1]!)}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function capital(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function ScopeChips({ scopes }: { scopes: readonly string[] }) {
  return (
    <div className={styles.chips}>
      {scopes.map((scope) => (
        <code key={scope}>{scope}</code>
      ))}
    </div>
  );
}
