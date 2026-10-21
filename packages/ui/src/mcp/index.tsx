'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Fingerprint,
  PlugsConnected,
  MagnifyingGlass,
  Wallet,
  Target,
  Users,
  CirclesThree,
  SlidersHorizontal,
  ClockCounterClockwise,
  CaretRight,
} from '@phosphor-icons/react';

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

const domains = [
  {
    id: 'finance',
    title: 'Everyday finance',
    icon: Wallet,
    parent: 'finapp.finance.parent',
    description: 'Find the right transactions without handing over your entire history.',
    features: ['Transactions', 'Accounts', 'Categories', 'Analytics'],
    filters: ['Date range', 'Account', 'Category', 'Type', 'Search'],
    prompt:
      'Show my expenses from the last 30 days. Start with finapp.finance.parent, then retrieve at most 25 transactions using an explicit date range. Ask before making changes.',
  },
  {
    id: 'planning',
    title: 'Budgets & goals',
    icon: Target,
    parent: 'finapp.finance.parent',
    description:
      'Bring budgets, savings goals, contributions, and recurring plans into the conversation.',
    features: ['Budgets', 'Goals', 'Contributions', 'Recurring rules'],
    filters: ['Date range', 'Limit', 'Cursor'],
    prompt:
      'Inspect finapp.finance.parent, then list up to 25 of my goals and budgets. Explain what you find without changing any records.',
  },
  {
    id: 'social',
    title: 'People & messages',
    icon: Users,
    parent: 'finapp.social.parent',
    description: 'Find friends, manage requests, and read the conversation you actually need.',
    features: ['Friends', 'Requests', 'People search', 'Direct messages'],
    filters: ['Direction', 'Conversation', 'Date range', 'Limit', 'Cursor'],
    prompt:
      'Inspect finapp.social.parent, then list up to 25 incoming friend requests. Do not accept or send requests without asking me.',
  },
  {
    id: 'groups',
    title: 'Shared money',
    icon: CirclesThree,
    parent: 'finapp.groups.parent',
    description: 'Keep shared expenses and conversations scoped to a group you belong to.',
    features: ['Groups', 'Members', 'Expenses', 'Settlements', 'Group chat'],
    filters: ['Group', 'Date range', 'Limit', 'Cursor'],
    prompt:
      'Start with finapp.groups.parent and list up to 25 of my groups. Ask which group to inspect before retrieving its expenses or messages.',
  },
  {
    id: 'personal',
    title: 'Your preferences',
    icon: SlidersHorizontal,
    parent: 'finapp.personal.parent',
    description: 'Review your profile, notifications, and privacy preferences on your terms.',
    features: ['Profile', 'Notifications', 'Privacy', 'Default account'],
    filters: ['Date range', 'Limit', 'Cursor'],
    prompt:
      'Inspect finapp.personal.parent, then show my current privacy settings. Explain the options and ask before changing anything.',
  },
] as const;
const clients = {
  chatgpt: {
    name: 'ChatGPT',
    path: 'Open Settings → Apps, then create a custom MCP connection. Availability depends on your plan and workspace.',
    link: 'https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt',
  },
  claude: {
    name: 'Claude',
    path: 'Open Settings → Connectors and add a custom remote connector. Use the URL below as the server address.',
    link: 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp',
  },
  other: {
    name: 'Other MCP client',
    path: 'Add a remote Streamable HTTP server in your client. It must support OAuth authorization-code flow with PKCE.',
    link: 'https://modelcontextprotocol.io/docs/develop/connect-remote-servers',
  },
};
const scopeNames: Record<string, string> = {
  'finapp:read': 'Read data',
  'finapp:write:finance': 'Finance writes',
  'finapp:write:social': 'Social writes',
  'finapp:write:groups': 'Group writes',
  'finapp:write:personal': 'Settings writes',
};
const tabs = [
  { id: 'connect', label: 'Connect' },
  { id: 'explore', label: 'Explore tools' },
  { id: 'connections', label: 'Permissions' },
  { id: 'activity', label: 'Activity' },
] as const;
type Tab = (typeof tabs)[number]['id'];

function CopyButton({
  value,
  label = 'Copy',
  primary = false,
}: {
  value: string;
  label?: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 3000);
  }
  return (
    <span className="mcp-copy-wrap">
      <button
        type="button"
        className={primary ? 'mcp-button is-primary' : 'mcp-button'}
        onClick={() => void copy()}
        aria-label={label}
      >
        {state === 'copied' ? <Check /> : <Copy />}
        <span>{state === 'copied' ? 'Copied' : label}</span>
      </button>
      <span className={state === 'copied' ? 'mcp-sr-only' : 'mcp-copy-feedback'} role="status">
        {state === 'copied'
          ? `${label} copied to clipboard.`
          : state === 'failed'
            ? 'Copy unavailable. Select and copy the text manually.'
            : ''}
      </span>
    </span>
  );
}

export function McpDashboard({
  signedIn,
  accountLoading = false,
  displayName,
  endpoint,
  connectHref,
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
  const [client, setClient] = useState<keyof typeof clients>('chatgpt');
  const [domainId, setDomainId] = useState<(typeof domains)[number]['id']>('finance');
  const [search, setSearch] = useState('');
  const [pendingRevocation, setPendingRevocation] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const activeConnections = connections.filter((connection) => connection.revokedAt === undefined);
  const visibleConnections = showRevoked ? connections : activeConnections;
  const domain = domains.find((item) => item.id === domainId)!;
  const filteredDomains = domains.filter((item) =>
    `${item.title} ${item.features.join(' ')}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
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
              <section className="mcp-setup">
                <div className="mcp-section-heading">
                  <div>
                    <p className="mcp-eyebrow">GET CONNECTED</p>
                    <h2>
                      Your next conversation
                      <br />
                      starts here.
                    </h2>
                  </div>
                  <span className="mcp-protocol">Streamable HTTP</span>
                </div>
                <fieldset className="mcp-client-picker">
                  <legend>Choose your AI client</legend>
                  {Object.entries(clients).map(([key, item]) => (
                    <label key={key} className={client === key ? 'is-selected' : ''}>
                      <input
                        type="radio"
                        name="mcp-client"
                        value={key}
                        checked={client === key}
                        onChange={() => setClient(key as keyof typeof clients)}
                      />
                      <span className="mcp-client-monogram" aria-hidden="true">
                        {key === 'chatgpt' ? 'G' : key === 'claude' ? 'C' : '+'}
                      </span>
                      <strong>{item.name}</strong>
                      <span className="mcp-radio-dot" />
                    </label>
                  ))}
                </fieldset>
                <ol className="mcp-setup-steps">
                  <li>
                    <span className="mcp-step-number">1</span>
                    <div>
                      <h3>Add Finapp to {clients[client].name}</h3>
                      <p>{clients[client].path}</p>
                      <a
                        href={clients[client].link}
                        target="_blank"
                        rel="noreferrer"
                        className="mcp-inline-link"
                      >
                        View setup guide <ArrowUpRight />
                      </a>
                    </div>
                  </li>
                  <li>
                    <span className="mcp-step-number">2</span>
                    <div>
                      <h3>Paste your server address</h3>
                      <p>Use this URL—not your password or a private API key.</p>
                      <div className="mcp-endpoint-control">
                        <code tabIndex={0}>{endpoint}</code>
                        <CopyButton value={endpoint} label="Copy URL" primary />
                      </div>
                    </div>
                  </li>
                  <li>
                    <span className="mcp-step-number">3</span>
                    <div>
                      <h3>Sign in. Review. Approve.</h3>
                      <p>
                        Your client opens Finapp so you can review permissions. Write access is
                        always a separate choice.
                      </p>
                      {!signedIn && (
                        <a className="mcp-inline-link" href={connectHref}>
                          Sign in to Finapp <ArrowRight />
                        </a>
                      )}
                    </div>
                  </li>
                </ol>
              </section>
              <aside className="mcp-connect-aside">
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
                  <p>“Show my expenses for the last 30 days. Ask before changing anything.”</p>
                  <button
                    className="mcp-inline-link"
                    type="button"
                    onClick={() => selectTab('explore')}
                  >
                    Explore what’s possible <ArrowRight />
                  </button>
                </div>
              </aside>
            </div>
          )}
          {tab === 'explore' && (
            <section className="mcp-explorer">
              <div className="mcp-section-heading">
                <div>
                  <p className="mcp-eyebrow">A SMALLER, SMARTER REQUEST</p>
                  <h2>
                    The right context.
                    <br />
                    Not your entire history.
                  </h2>
                </div>
                <p>
                  Parent tools help your AI choose a domain before retrieving a specific, filtered
                  page.
                </p>
              </div>
              <label className="mcp-search">
                <MagnifyingGlass />
                <span className="mcp-sr-only">Search domains and features</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearch(value);
                    const match = domains.find((item) =>
                      `${item.title} ${item.features.join(' ')}`
                        .toLowerCase()
                        .includes(value.toLowerCase().trim()),
                    );
                    if (match) setDomainId(match.id);
                  }}
                  placeholder="Find transactions, goals, messages…"
                />
              </label>
              <div className="mcp-explorer-layout">
                <div className="mcp-domain-list" aria-label="Feature domains">
                  {filteredDomains.length ? (
                    filteredDomains.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={domainId === item.id ? 'is-selected' : ''}
                          aria-pressed={domainId === item.id}
                          onClick={() => setDomainId(item.id)}
                        >
                          <Icon weight="light" />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.features.slice(0, 3).join(' · ')}</small>
                          </span>
                          <CaretRight />
                        </button>
                      );
                    })
                  ) : (
                    <p className="mcp-no-results" role="status">
                      No matching domains.
                      <button
                        className="mcp-inline-link"
                        onClick={() => setSearch('')}
                        type="button"
                      >
                        Clear search
                      </button>
                    </p>
                  )}
                </div>
                <article className="mcp-domain-detail" hidden={filteredDomains.length === 0}>
                  <div className="mcp-domain-detail-header">
                    <domain.icon weight="light" />
                    <span>DOMAIN PARENT</span>
                  </div>
                  <h3>{domain.title}</h3>
                  <p>{domain.description}</p>
                  <div className="mcp-parent-code">
                    <code>{domain.parent}</code>
                    <CopyButton key={domain.id} value={domain.parent} label="Copy parent" />
                  </div>
                  <h4>What you can work with</h4>
                  <div className="mcp-feature-list">
                    {domain.features.map((feature) => (
                      <span key={feature}>{feature}</span>
                    ))}
                  </div>
                  <h4>Retrieve only what you need</h4>
                  <p className="mcp-filter-copy">
                    Available filters depend on the child tool. Pages return at most 100 records;
                    time-windowed reads cap at 366 days.
                  </p>
                  <div className="mcp-filter-chips">
                    {domain.filters.map((filter) => (
                      <span key={filter}>
                        <SlidersHorizontal />
                        {filter}
                      </span>
                    ))}
                  </div>
                  <div className="mcp-prompt">
                    <span className="mcp-eyebrow">READY FOR YOUR NEXT CONVERSATION</span>
                    <p>{domain.prompt}</p>
                    <CopyButton key={domain.id} value={domain.prompt} label="Copy prompt" />
                  </div>
                </article>
              </div>
            </section>
          )}
          {(tab === 'connections' || tab === 'activity') && !signedIn && (
            <div className="mcp-gated">
              <div className="mcp-empty-symbol">
                <Fingerprint weight="light" />
              </div>
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
                  <i />
                  <i />
                  <i />
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
