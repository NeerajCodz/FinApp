'use client';

import { useState, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Fingerprint,
  PlugsConnected,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { ListSkeleton } from '../web/visual';
import { Illustration } from '../illustrations/web';
import {
  ConnectGuide,
  CopyButton,
  ServerStatusCard,
  ToolCatalog,
  WidgetGallery,
  scopeNames,
  type McpCatalogEntry,
  type McpWidgetPreview,
} from './sections';

export type { McpCatalogEntry, McpWidgetPreview, McpServerStatus } from './sections';

export type McpConnection = {
  id: string;
  clientName: string;
  scopes: string[];
  createdAt: number;
  revokedAt?: number;
};
export type McpActivity = {
  id: string;
  clientName: string;
  toolName: string;
  succeeded: boolean;
  createdAt: number;
};
export type McpActivityDomain = 'all' | 'finance' | 'social' | 'groups' | 'personal';
export type McpActivityOutcome = 'all' | 'success' | 'failed';
export type McpActivityWindow = 'day' | 'week' | 'month' | 'all';
export type McpDashboardProps = {
  signedIn: boolean;
  accountLoading?: boolean;
  displayName?: string;
  endpoint: string;
  connectHref: string;
  /** Public status endpoint polled by the live server check. */
  statusUrl: string;
  catalog: McpCatalogEntry[];
  widgetPreviews: McpWidgetPreview[];
  theme?: 'light' | 'dark';
  connections?: McpConnection[];
  onRevoke?: (grantId: string) => Promise<boolean>;
  revokingGrantId?: string | null;
  activity?: McpActivity[];
  activityLoading?: boolean;
  activityRetained?: number;
  activityMatching?: number;
  activityHasMore?: boolean;
  activityDomain: McpActivityDomain;
  onActivityDomainChange: (domain: McpActivityDomain) => void;
  activityOutcome: McpActivityOutcome;
  onActivityOutcomeChange: (outcome: McpActivityOutcome) => void;
  activityWindow: McpActivityWindow;
  onActivityWindowChange: (window: McpActivityWindow) => void;
};

const tabs = [
  { id: 'connect', label: 'Connect' },
  { id: 'explore', label: 'Tools' },
  { id: 'widgets', label: 'In-chat widgets' },
  { id: 'connections', label: 'Permissions' },
  { id: 'activity', label: 'Activity' },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function McpDashboard({
  signedIn,
  accountLoading = false,
  displayName,
  endpoint,
  connectHref,
  statusUrl,
  catalog,
  widgetPreviews,
  theme = 'dark',
  connections = [],
  onRevoke,
  revokingGrantId,
  activity = [],
  activityLoading = false,
  activityRetained = 0,
  activityMatching = 0,
  activityHasMore = false,
  activityDomain,
  onActivityDomainChange,
  activityOutcome,
  onActivityOutcomeChange,
  activityWindow,
  onActivityWindowChange,
}: McpDashboardProps) {
  const [tab, setTab] = useState<Tab>('connect');
  const [pendingRevocation, setPendingRevocation] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const activeConnections = connections.filter((connection) => connection.revokedAt === undefined);
  const visibleConnections = showRevoked ? connections : activeConnections;
  function selectTab(next: Tab) {
    setTab(next);
    document.getElementById(`mcp-tab-${next}`)?.focus();
  }
  async function confirmRevocation(id: string) {
    try {
      if (await onRevoke?.(id)) {
        setPendingRevocation(null);
        setRevokeError(null);
      } else setRevokeError(id);
    } catch {
      setRevokeError(id);
    }
  }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`mcp-tab-${tabs[next].id}`)?.focus();
  }
  return (
    <main className="mcp-workspace">
      <a className="mcp-skip-link" href="#mcp-panel">
        Skip to workspace
      </a>
      <div className="mcp-workspace-inner">
        <nav className="mcp-topbar" aria-label="MCP workspace">
          <a href="/dashboard" className="mcp-brand">
            <span className="mcp-brand-mark" aria-hidden="true">
              F
            </span>
            finapp
            <span className="mcp-brand-divider" />
            Integrations
          </a>
          <a href="/dashboard" className="mcp-back-link">
            <ArrowLeft /> Back to app
          </a>
        </nav>
        <header className="mcp-workspace-header">
          <div>
            <p className="mcp-eyebrow">YOUR ACCOUNT. YOUR CONNECTIONS.</p>
            <h1>
              A little more
              <br />
              <span>connected.</span>
            </h1>
            <p className="mcp-lede">
              Bring Finapp into your AI conversations.
              <br className="mcp-desktop-break" /> You choose the client. You control the access.
            </p>
          </div>
          <div className="mcp-bridge" aria-label="Connection requires your permission">
            <div className="mcp-bridge-node">
              <span className="mcp-brand-mark">F</span>
              <span>Finapp</span>
            </div>
            <div className="mcp-bridge-line">
              <Fingerprint />
              <span>With your permission</span>
            </div>
            <div className="mcp-bridge-node">
              <PlugsConnected weight="light" />
              <span>Your AI client</span>
            </div>
          </div>
        </header>
        <div className="mcp-toolbar">
          <div className="mcp-tabs" role="tablist" aria-label="Integration workspace">
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`mcp-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls="mcp-panel"
                tabIndex={tab === item.id ? 0 : -1}
                onKeyDown={(event) => tabKeys(event, index)}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
                {item.id === 'connections' && signedIn && <span>{activeConnections.length}</span>}
              </button>
            ))}
          </div>
          <div className={`mcp-session ${signedIn ? 'is-signed-in' : ''}`}>
            <i />
            {accountLoading
              ? 'Checking account…'
              : signedIn
                ? (displayName ?? 'Signed in')
                : 'Not signed in'}
          </div>
        </div>
        <section
          id="mcp-panel"
          className="mcp-tab-panel"
          role="tabpanel"
          aria-labelledby={`mcp-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'connect' && (
            <div className="mcp-connect-layout">
              <ConnectGuide endpoint={endpoint} signedIn={signedIn} connectHref={connectHref} />
              <aside className="mcp-connect-aside">
                <ServerStatusCard statusUrl={statusUrl} endpoint={endpoint} />
                <div className="mcp-trust-panel">
                  <Fingerprint weight="light" />
                  <h3>
                    Connected doesn’t
                    <br />
                    mean wide open.
                  </h3>
                  <p>Each client gets its own permissions. Revoke access whenever you want.</p>
                  <ul>
                    <li>
                      <Check />
                      Read access before write access
                    </li>
                    <li>
                      <Check />
                      Filtered, bounded data requests
                    </li>
                    <li>
                      <Check />
                      Account and group checks on every call
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="mcp-inline-link"
                    onClick={() => selectTab('connections')}
                  >
                    Review permissions <ArrowRight />
                  </button>
                </div>
                <div className="mcp-first-prompt">
                  <span className="mcp-eyebrow">TRY A FIRST PROMPT</span>
                  <p>“Show my FinApp overview, then who owes me in my groups.”</p>
                  <CopyButton
                    value="Show my FinApp overview, then who owes me in my groups. Ask before changing anything."
                    label="Copy prompt"
                  />
                  <button
                    className="mcp-inline-link"
                    type="button"
                    onClick={() => selectTab('widgets')}
                  >
                    See the in-chat widgets <ArrowRight />
                  </button>
                </div>
              </aside>
            </div>
          )}
          {tab === 'explore' && <ToolCatalog catalog={catalog} />}
          {tab === 'widgets' && <WidgetGallery previews={widgetPreviews} theme={theme} />}
          {(tab === 'connections' || tab === 'activity') && !signedIn && (
            <div className="mcp-gated">
              <Illustration scene={tab === 'activity' ? 'history' : 'welcome'} size={176} />
              <p className="mcp-eyebrow">PRIVATE TO YOUR ACCOUNT</p>
              <h2>
                {accountLoading
                  ? 'Checking your account.'
                  : tab === 'activity'
                    ? 'Your tools. Your trail.'
                    : 'Access stays in your hands.'}
              </h2>
              <p>
                {accountLoading
                  ? 'Your connections will appear once your session is ready.'
                  : tab === 'activity'
                    ? 'Sign in to filter recent tool calls by domain, outcome, and time. We never record their arguments or results.'
                    : 'Sign in to see which AI clients have access, review their permissions, or disconnect them.'}
              </p>
              {!accountLoading && (
                <a className="mcp-button is-primary" href={connectHref}>
                  Sign in to continue <ArrowRight />
                </a>
              )}
            </div>
          )}
          {tab === 'connections' && signedIn && (
            <section>
              <div className="mcp-section-heading">
                <div>
                  <p className="mcp-eyebrow">ACCESS ON YOUR TERMS</p>
                  <h2>Your AI connections</h2>
                </div>
                <label className="mcp-history-toggle">
                  <input
                    type="checkbox"
                    checked={showRevoked}
                    onChange={(event) => setShowRevoked(event.target.checked)}
                  />
                  Include revoked grants
                </label>
              </div>
              {visibleConnections.length === 0 ? (
                <div className="mcp-empty-state">
                  <PlugsConnected weight="light" />
                  <h3>{showRevoked ? 'No authorizations yet.' : 'No active connections.'}</h3>
                  <p>Connect an AI client and its approved permissions will appear here.</p>
                  <button className="mcp-button" type="button" onClick={() => selectTab('connect')}>
                    Set up a connection <ArrowRight />
                  </button>
                </div>
              ) : (
                <div className="mcp-connections-list">
                  {visibleConnections.map((connection) => {
                    const revoked = connection.revokedAt !== undefined;
                    const pending = pendingRevocation === connection.id;
                    const busy = Boolean(revokingGrantId);
                    return (
                      <article
                        className={`mcp-connection-card ${revoked ? 'is-revoked' : ''}`}
                        key={connection.id}
                      >
                        <header>
                          <span className="mcp-connection-mark">
                            <PlugsConnected weight="light" />
                          </span>
                          <div>
                            <h3>{connection.clientName}</h3>
                            <p>Authorized {new Date(connection.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="mcp-connection-status">
                            {revoked ? 'Revoked' : 'Active grant'}
                          </span>
                        </header>
                        <div className="mcp-connection-scopes">
                          {connection.scopes.map((scope) => (
                            <span title={scope} key={scope}>
                              {scopeNames[scope] ?? scope}
                            </span>
                          ))}
                        </div>
                        {revoked ? (
                          <p className="mcp-connection-revoked">
                            Revoked {new Date(connection.revokedAt!).toLocaleDateString()}
                          </p>
                        ) : pending ? (
                          <div className="mcp-revoke-confirm">
                            <h4>Disconnect {connection.clientName}?</h4>
                            <p>New requests will be denied. In-flight requests may finish.</p>
                            {revokeError === connection.id && (
                              <p className="mcp-error" role="alert">
                                Could not revoke access. Try again.
                              </p>
                            )}
                            <div>
                              <button
                                className="mcp-button is-danger"
                                type="button"
                                disabled={busy}
                                onClick={() => void confirmRevocation(connection.id)}
                              >
                                {revokingGrantId === connection.id ? 'Revoking…' : 'Revoke access'}
                              </button>
                              <button
                                className="mcp-button"
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setPendingRevocation(null);
                                  setRevokeError(null);
                                }}
                              >
                                Keep access
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="mcp-revoke-button"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPendingRevocation(connection.id);
                              setRevokeError(null);
                            }}
                          >
                            Revoke access <ArrowUpRight />
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="mcp-footnote">
                A grant is permission to connect, not proof of an active client session. Access
                tokens expire after one hour.
              </p>
            </section>
          )}
          {tab === 'activity' && signedIn && (
            <section>
              <div className="mcp-section-heading">
                <div>
                  <p className="mcp-eyebrow">A CLEAR RECORD</p>
                  <h2>Tool activity</h2>
                </div>
                <p>
                  Tool names and outcomes only.
                  <br />
                  Your financial data stays out of this log.
                </p>
              </div>
              <div className="mcp-activity-filters">
                <label>
                  Domain
                  <select
                    value={activityDomain}
                    onChange={(event) =>
                      onActivityDomainChange(event.target.value as McpActivityDomain)
                    }
                  >
                    <option value="all">All domains</option>
                    <option value="finance">Finance</option>
                    <option value="social">Social</option>
                    <option value="groups">Groups</option>
                    <option value="personal">Personal</option>
                  </select>
                </label>
                <label>
                  Outcome
                  <select
                    value={activityOutcome}
                    onChange={(event) =>
                      onActivityOutcomeChange(event.target.value as McpActivityOutcome)
                    }
                  >
                    <option value="all">All outcomes</option>
                    <option value="success">Succeeded</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <label>
                  Time
                  <select
                    value={activityWindow}
                    onChange={(event) =>
                      onActivityWindowChange(event.target.value as McpActivityWindow)
                    }
                  >
                    <option value="day">Last 24 hours</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">Last 30 days</option>
                    <option value="all">Latest stored</option>
                  </select>
                </label>
                <button
                  className="mcp-inline-link"
                  type="button"
                  onClick={() => {
                    onActivityDomainChange('all');
                    onActivityOutcomeChange('all');
                    onActivityWindowChange('week');
                  }}
                >
                  Reset filters
                </button>
              </div>
              {activityLoading ? (
                <div className="mcp-activity-skeleton" role="status">
                  <span className="mcp-sr-only">Loading tool activity</span>
                  <ListSkeleton rows={3} />
                </div>
              ) : activity.length === 0 ? (
                <div className="mcp-empty-state">
                  <ClockCounterClockwise weight="light" />
                  <h3>
                    {activityRetained === 0
                      ? 'Your story starts with a tool call.'
                      : 'Nothing matches these filters.'}
                  </h3>
                  <p>
                    {activityRetained === 0
                      ? 'Use a connected AI client to see its recent tool names and outcomes here.'
                      : 'Try a different domain, outcome, or time window.'}
                  </p>
                </div>
              ) : (
                <div className="mcp-activity-list">
                  {activity.map((event) => (
                    <article className="mcp-activity-row" key={event.id}>
                      <span
                        className={`mcp-outcome-dot ${event.succeeded ? 'is-success' : 'is-failure'}`}
                      />
                      <div>
                        <code>{event.toolName}</code>
                        <span>{event.clientName}</span>
                      </div>
                      <time dateTime={new Date(event.createdAt).toISOString()}>
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                      <span
                        className={`mcp-activity-outcome ${event.succeeded ? 'is-success' : 'is-failure'}`}
                      >
                        {event.succeeded ? 'Succeeded' : 'Failed'}
                      </span>
                    </article>
                  ))}
                </div>
              )}
              <p className="mcp-footnote" role="status">
                Showing {activity.length} of {activityMatching} matching events · {activityRetained}
                /100 recent events stored.
                {activityHasMore ? ' Narrow your filters to find older matching events.' : ''}
              </p>
            </section>
          )}
        </section>
        <footer className="mcp-workspace-footer">
          <span>
            <Fingerprint />
            Your data has boundaries. Keep them.
          </span>
          <div>
            <a href="/privacy">Privacy</a>
            <a href="https://modelcontextprotocol.io/" target="_blank" rel="noreferrer">
              About MCP <ArrowUpRight />
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
