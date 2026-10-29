'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useConvexAuth, useAuthToken } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button, ThemeProvider } from '@finapp/ui/web';
import { authorizationDenialUrl } from '@/lib/mcp/authorizationCallback';

type AuthorizationRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string[];
};

const scopeCopy: Record<string, { title: string; description: string }> = {
  'finapp:read': {
    title: 'Read your Finapp data',
    description:
      'View bounded finance, planning, groups, social, profile, notification, and privacy results.',
  },
  'finapp:write:finance': {
    title: 'Change your finance data',
    description:
      'Create transactions, accounts, categories, budgets, goals, and recurring rules, or add contributions.',
  },
  'finapp:write:social': {
    title: 'Manage social connections',
    description:
      'Send or respond to friend requests, start direct conversations, and send direct messages.',
  },
  'finapp:write:groups': {
    title: 'Manage shared groups',
    description:
      'Create groups and expenses, invite members, respond to invitations, record settlements, and send group messages.',
  },
  'finapp:write:personal': {
    title: 'Manage personal settings',
    description:
      'Update profile details, privacy controls, default account, and notification preferences, or mark notifications read.',
  },
};

export function McpAuthorizeScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const token = useAuthToken();
  const [request, setRequest] = useState<AuthorizationRequest | null>(null);
  const [requestChecked, setRequestChecked] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['finapp:read']);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const profile = useQuery(api.mcpOAuth.currentUser, isAuthenticated ? {} : 'skip');
  const registeredClient = useQuery(
    api.mcpOAuth.client,
    request ? { clientId: request.clientId } : 'skip',
  );
  const createCode = useMutation(api.mcpOAuth.createAuthorizationCode);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestChecked(true);
    const rawScopes = (params.get('scope') ?? 'finapp:read').split(/\s+/).filter(Boolean);
    const nextRequest = {
      clientId: params.get('client_id') ?? '',
      clientName: params.get('client_name') ?? 'MCP client',
      redirectUri: params.get('redirect_uri') ?? '',
      state: params.get('state') ?? '',
      codeChallenge: params.get('code_challenge') ?? '',
      scope: [...new Set(['finapp:read', ...rawScopes])],
    };
    if (
      !nextRequest.clientId ||
      !nextRequest.redirectUri ||
      !nextRequest.state ||
      !/^[A-Za-z0-9_-]{43}$/.test(nextRequest.codeChallenge) ||
      rawScopes.some((scope) => !Object.hasOwn(scopeCopy, scope))
    ) {
      setError(
        'This authorization request is invalid. Restart the connection from your MCP client.',
      );
      return;
    }
    setRequest(nextRequest);
    setSelectedScopes(['finapp:read']);
  }, []);

  const loginUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/mcp/login';
    const next = `${window.location.pathname}${window.location.search}`;
    return `/mcp/login?next=${encodeURIComponent(next)}`;
  }, [request]);

  async function authorize() {
    if (
      !request ||
      !token ||
      !profile ||
      !registeredClient?.redirectUris.includes(request.redirectUri) ||
      pending
    )
      return;
    setPending(true);
    setError('');
    try {
      const code = await createCode({
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        scopes: selectedScopes,
      });
      const callback = new URL(request.redirectUri);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', request.state);
      window.location.assign(callback.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not authorize this connection.');
      setPending(false);
    }
  }

  function toggleScope(scope: string) {
    if (scope === 'finapp:read') return;
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope],
    );
  }
  const clientMismatch = Boolean(
    request &&
    registeredClient !== undefined &&
    (!registeredClient || !registeredClient.redirectUris.includes(request.redirectUri)),
  );
  const loading =
    !requestChecked ||
    Boolean(
      request &&
      (isLoading || (isAuthenticated && profile === undefined) || registeredClient === undefined),
    );

  if (loading) {
    return (
      <ConsentFrame>
        <section className="mcp-access-state" role="status" aria-live="polite" aria-busy="true">
          <p className="mcp-access-eyebrow">PREPARING YOUR CONNECTION</p>
          <h1>Checking the details.</h1>
          <p>Loading your session and the client’s registered connection details.</p>
          <div className="mcp-access-skeleton" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </section>
      </ConsentFrame>
    );
  }

  if (!request || clientMismatch || (isAuthenticated && !profile)) {
    return (
      <ConsentFrame>
        <section className="mcp-access-state" aria-labelledby="mcp-auth-title">
          <p className="mcp-access-eyebrow">CONNECTION NOT AVAILABLE</p>
          <h1 id="mcp-auth-title">This request can’t continue.</h1>
          <p className="mcp-access-error" role="alert">
            {error ||
              (clientMismatch
                ? 'The client or return address does not match a registered connection. Restart from your MCP client.'
                : 'Your Finapp account could not be loaded. Return to the dashboard to sign in again.')}
          </p>
          <p>No access has been approved from this page.</p>
          <Link className="mcp-access-primary" href="/mcp/dashboard">
            Return to dashboard <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </ConsentFrame>
    );
  }

  if (!isAuthenticated) {
    return (
      <ConsentFrame>
        <section className="mcp-access-state" aria-labelledby="mcp-auth-title">
          <p className="mcp-access-eyebrow">01 / SIGN IN</p>
          <h1 id="mcp-auth-title">Your account comes first.</h1>
          <p>
            <strong>{registeredClient?.clientName ?? 'This MCP client'}</strong> wants to connect to
            Finapp. Sign in to review the requested permissions before deciding.
          </p>
          <p>Signing in does not grant access.</p>
          <Link className="mcp-access-primary" href={loginUrl}>
            Continue to sign in <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </ConsentFrame>
    );
  }

  const writeScopes = request.scope.filter((scope) => scope !== 'finapp:read');
  const selectedWrites = writeScopes.filter((scope) => selectedScopes.includes(scope)).length;
  const denialUrl = authorizationDenialUrl(request, registeredClient);

  function scopeRow(scope: string, required = false) {
    const selected = selectedScopes.includes(scope);
    return (
      <label
        className={`mcp-access-scope${selected ? ' is-selected' : ''}${required ? ' is-required' : ''}`}
        key={scope}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={required || pending}
          onChange={() => toggleScope(scope)}
          aria-describedby={`scope-${scope}-description`}
        />
        <span className="mcp-access-scope-copy">
          <span className="mcp-access-scope-heading">
            <strong>{scopeCopy[scope].title}</strong>
            <span>{required ? 'Required' : selected ? 'Selected' : 'Optional'}</span>
          </span>
          <small id={`scope-${scope}-description`}>{scopeCopy[scope].description}</small>
        </span>
      </label>
    );
  }

  return (
    <ConsentFrame>
      <div className="mcp-access-layout">
        <aside className="mcp-access-story">
          <p className="mcp-access-eyebrow">02 / REVIEW ACCESS</p>
          <h1 id="mcp-auth-title">
            A little access.
            <br />
            <em>A clear choice.</em>
          </h1>
          <p>
            Review what this client is asking for. Only the permissions you select will be approved.
          </p>
          <div className="mcp-access-identity">
            <span className="mcp-access-avatar" aria-hidden="true">
              {profile?.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <small>Signed in to Finapp as</small>
              <strong>{profile?.displayName}</strong>
            </div>
          </div>
          <p className="mcp-access-trust-note">
            Client registration is not an endorsement by Finapp. Only connect clients you recognize
            and trust.
          </p>
        </aside>
        <div className="mcp-access-bezel">
          <section className="mcp-access-review" aria-labelledby="mcp-review-title">
            <header className="mcp-access-client">
              <span className="mcp-access-client-icon" aria-hidden="true">
                ↗
              </span>
              <div>
                <p className="mcp-access-eyebrow">REQUESTING CLIENT</p>
                <h2 id="mcp-review-title">{registeredClient?.clientName}</h2>
              </div>
            </header>
            <details className="mcp-access-details" open>
              <summary>Client and return destination</summary>
              <dl>
                <dt>Client ID</dt>
                <dd>
                  <code dir="ltr">{request.clientId}</code>
                </dd>
                <dt>After approval, return to</dt>
                <dd>
                  <code dir="ltr">{request.redirectUri}</code>
                </dd>
              </dl>
              <p>This is the client’s registered return address. Check it before approving.</p>
            </details>
            <div className="mcp-access-permissions">
              <fieldset>
                <legend>
                  Read access <span>1 requested · 1 required</span>
                </legend>
                {scopeRow('finapp:read', true)}
              </fieldset>
              <fieldset>
                <legend>
                  Write access{' '}
                  <span>
                    {writeScopes.length} requested · {selectedWrites} selected
                  </span>
                </legend>
                <p className="mcp-access-permission-note">
                  Write access lets this client make changes on your behalf. All write permissions
                  start off.
                </p>
                {writeScopes.length ? (
                  writeScopes.map((scope) => scopeRow(scope))
                ) : (
                  <p className="mcp-access-no-write">
                    This client has not requested permission to change your data.
                  </p>
                )}
              </fieldset>
            </div>
            {error && (
              <p className="mcp-access-error" role="alert">
                {error}
              </p>
            )}
            <div className="mcp-access-decision">
              <p aria-live="polite">
                Approving{' '}
                <strong>
                  read access
                  {selectedWrites
                    ? ` + ${selectedWrites} write permission${selectedWrites === 1 ? '' : 's'}`
                    : ' only'}
                </strong>
                .
              </p>
              <div className="mcp-access-actions">
                {pending ? (
                  <span className="mcp-access-decline" aria-disabled="true">
                    Decline
                  </span>
                ) : (
                  <Link className="mcp-access-decline" href={denialUrl ?? '/mcp/dashboard'}>
                    Decline
                  </Link>
                )}
                <Button type="button" onClick={authorize} disabled={pending} aria-busy={pending}>
                  {pending ? 'Connecting…' : 'Approve access'}
                  <span aria-hidden="true">↗</span>
                </Button>
              </div>
              <small>You can revoke this connection later in your MCP dashboard.</small>
            </div>
          </section>
        </div>
      </div>
    </ConsentFrame>
  );
}

function ConsentFrame({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider forcedMode="dark">
      <main className="mcp-access-page">
        <a className="mcp-access-skip" href="#mcp-access-content">
          Skip to connection review
        </a>
        <header className="mcp-access-header">
          <Link className="mcp-access-brand" href="/mcp/dashboard">
            finapp<span>MCP</span>
          </Link>
          <Link className="mcp-access-back" href="/mcp/dashboard">
            ← Connection dashboard
          </Link>
        </header>
        <div id="mcp-access-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="mcp-access-footer">
          Finapp MCP <span>Your permissions stay in your hands.</span>
          <Link href="/privacy">Privacy notes ↗</Link>
        </footer>
      </main>
    </ThemeProvider>
  );
}
