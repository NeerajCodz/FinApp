'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { isApiScope, SCOPE_DESCRIPTIONS, type ApiScope } from '@convex/publicApi/scopes';
import { Button, ThemeProvider } from '@finapp/ui/web';
import { authorizationDenialUrl, currentIssuer } from '@finapp/mcp/authorizationCallback';

type ConsentRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: ApiScope[];
};

const isWrite = (scope: string) => scope.endsWith(':write') || scope === 'webhooks:manage';

export function AppConsentScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [request, setRequest] = useState<ConsentRequest | null>(null);
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<ApiScope[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const profile = useQuery(api.mcpOAuth.currentUser, isAuthenticated ? {} : 'skip');
  const app = useQuery(
    api.publicApi.oauthApps.publicApp,
    request ? { clientId: request.clientId } : 'skip',
  );
  const authorize = useMutation(api.publicApi.oauthApps.authorize);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scopes = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);
    const next = {
      clientId: params.get('client_id') ?? '',
      redirectUri: params.get('redirect_uri') ?? '',
      state: params.get('state') ?? '',
      codeChallenge: params.get('code_challenge') ?? '',
      scopes: scopes.filter(isApiScope),
    };
    setChecked(true);
    if (
      !next.clientId ||
      !next.redirectUri ||
      !next.state ||
      !/^[A-Za-z0-9_-]{43}$/.test(next.codeChallenge) ||
      !scopes.length ||
      next.scopes.length !== scopes.length
    ) {
      setError('This authorization request is invalid. Start again from the app.');
      return;
    }
    setRequest(next);
    // Reads start selected; writes start off and must be opted into.
    setSelected(next.scopes.filter((scope) => !isWrite(scope)));
  }, []);

  const loginUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/mcp/login';
    return `/mcp/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
  }, [request]);

  const mismatch = Boolean(
    request && app !== undefined && (!app || !app.redirectUris.includes(request.redirectUri)),
  );
  const loading =
    !checked ||
    Boolean(
      request && (isLoading || (isAuthenticated && profile === undefined) || app === undefined),
    );

  async function approve() {
    if (!request || !app || pending || !selected.length) return;
    setPending(true);
    setError('');
    try {
      const code = await authorize({
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        scopes: selected,
      });
      const callback = new URL(request.redirectUri);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', request.state);
      callback.searchParams.set('iss', currentIssuer());
      window.location.assign(callback.toString());
    } catch {
      setError('Could not authorize this app. Try again.');
      setPending(false);
    }
  }

  if (loading)
    return (
      <Frame>
        <section className="mcp-access-state" role="status" aria-busy="true">
          <p className="mcp-access-eyebrow">PREPARING</p>
          <h1>Checking the details.</h1>
          <div className="mcp-access-skeleton" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </section>
      </Frame>
    );

  if (!request || mismatch || !app || (isAuthenticated && !profile))
    return (
      <Frame>
        <section className="mcp-access-state" aria-labelledby="consent-title">
          <p className="mcp-access-eyebrow">CONNECTION NOT AVAILABLE</p>
          <h1 id="consent-title">This request can’t continue.</h1>
          <p className="mcp-access-error" role="alert">
            {error ||
              'The app or its return address does not match a registered app. Start again from the app.'}
          </p>
          <p>No access has been approved from this page.</p>
        </section>
      </Frame>
    );

  if (!isAuthenticated)
    return (
      <Frame>
        <section className="mcp-access-state" aria-labelledby="consent-title">
          <p className="mcp-access-eyebrow">01 / SIGN IN</p>
          <h1 id="consent-title">Your account comes first.</h1>
          <p>
            <strong>{app.name}</strong> wants to connect to your Finapp. Sign in to review what it
            is asking for. Signing in does not grant access.
          </p>
          <Link className="mcp-access-primary" href={loginUrl}>
            Continue to sign in <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </Frame>
    );

  const denial = authorizationDenialUrl(
    { clientId: request.clientId, redirectUri: request.redirectUri, state: request.state },
    { clientId: app.clientId, redirectUris: app.redirectUris },
  );
  const toggle = (scope: ApiScope) =>
    setSelected((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope],
    );

  return (
    <Frame>
      <div className="mcp-access-layout">
        <aside className="mcp-access-story">
          <p className="mcp-access-eyebrow">02 / REVIEW ACCESS</p>
          <h1 id="consent-title">
            {app.name}
            <br />
            <em>wants access.</em>
          </h1>
          <p>Only the permissions you leave selected are granted. You can disconnect it anytime.</p>
          <div className="mcp-access-identity">
            <span className="mcp-access-avatar" aria-hidden="true">
              {profile?.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <small>Signed in as</small>
              <strong>{profile?.displayName}</strong>
            </div>
          </div>
          <p className="mcp-access-trust-note">
            Registered by {app.developer}. Apps are not reviewed or endorsed by Finapp; only connect
            apps you trust.
          </p>
        </aside>
        <div className="mcp-access-bezel">
          <section className="mcp-access-review" aria-labelledby="consent-app">
            <header className="mcp-access-client">
              <span className="mcp-access-client-icon" aria-hidden="true">
                {app.logoUrl ? (
                  <img src={app.logoUrl} alt="" width={28} height={28} />
                ) : (
                  app.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <p className="mcp-access-eyebrow">REQUESTING APP</p>
                <h2 id="consent-app">{app.name}</h2>
              </div>
            </header>
            {app.description ? <p>{app.description}</p> : null}
            <details className="mcp-access-details">
              <summary>App and return destination</summary>
              <dl>
                <dt>Client ID</dt>
                <dd>
                  <code dir="ltr">{app.clientId}</code>
                </dd>
                <dt>After approval, return to</dt>
                <dd>
                  <code dir="ltr">{request.redirectUri}</code>
                </dd>
                {app.homepageUrl ? (
                  <>
                    <dt>Website</dt>
                    <dd>
                      <code dir="ltr">{app.homepageUrl}</code>
                    </dd>
                  </>
                ) : null}
              </dl>
            </details>
            <div className="mcp-access-permissions">
              <fieldset>
                <legend>
                  Permissions{' '}
                  <span>
                    {request.scopes.length} requested · {selected.length} selected
                  </span>
                </legend>
                <p className="mcp-access-permission-note">
                  Permissions that change your data start off.
                </p>
                {request.scopes.map((scope) => {
                  const on = selected.includes(scope);
                  return (
                    <label key={scope} className={`mcp-access-scope${on ? ' is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={pending}
                        onChange={() => toggle(scope)}
                      />
                      <span className="mcp-access-scope-copy">
                        <span className="mcp-access-scope-heading">
                          <strong>
                            <code>{scope}</code>
                          </strong>
                          <span>{isWrite(scope) ? 'Changes data' : 'Read only'}</span>
                        </span>
                        <small>{SCOPE_DESCRIPTIONS[scope]}</small>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </div>
            {error ? (
              <p className="mcp-access-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mcp-access-decision">
              <div className="mcp-access-actions">
                <a className="mcp-access-decline" href={denial ?? '/'}>
                  Decline
                </a>
                <Button
                  type="button"
                  onClick={approve}
                  disabled={pending || !selected.length}
                  aria-busy={pending}
                >
                  {pending ? 'Connecting…' : 'Approve access'}
                </Button>
              </div>
              <small>Manage connected apps in Settings → Developer.</small>
            </div>
          </section>
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider forcedMode="dark">
      <main className="mcp-access-page">
        <header className="mcp-access-header">
          <Link className="mcp-access-brand" href="/">
            finapp<span>API</span>
          </Link>
        </header>
        <div id="consent-content">{children}</div>
        <footer className="mcp-access-footer">
          Finapp API <span>Your permissions stay in your hands.</span>
          <Link href="/privacy">Privacy notes ↗</Link>
        </footer>
      </main>
    </ThemeProvider>
  );
}
