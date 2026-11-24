'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ArrowUpRight,
  Browsers,
  Check,
  Copy,
  Lightning,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  Wrench,
} from '@phosphor-icons/react';
import { HeroCard, IconTile, ListSkeleton, StatTile, StatusPill } from '../web/visual';
import { Illustration } from '../illustrations/web';

export type McpCatalogEntry = {
  name: string;
  title: string;
  description: string;
  domain: 'finance' | 'social' | 'groups' | 'personal';
  scope: string;
  readOnly: boolean;
  destructive: boolean;
  widget?: { id: string; uri: string; title: string };
};
export type McpWidgetPreview = {
  id: string;
  title: string;
  description: string;
  toolName: string;
  html: string;
  /** structuredContent the preview host pushes into the widget. */
  sample: unknown;
};
export type McpServerStatus = {
  /** `degraded`: configured, but the backend could not be reached. */
  status: 'ok' | 'degraded' | 'not_configured';
  version: string;
  toolCount: number;
  widgetCount: number;
  endpoint: string | null;
};

export const scopeNames: Record<string, string> = {
  'finapp:read': 'Read data',
  'finapp:write:finance': 'Finance writes',
  'finapp:write:social': 'Social writes',
  'finapp:write:groups': 'Group writes',
  'finapp:write:personal': 'Settings writes',
};

export function CopyButton({
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

// ---------- Live server status ----------

export function ServerStatusCard({ statusUrl, endpoint }: { statusUrl: string; endpoint: string }) {
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [state, setState] = useState<
    'checking' | 'online' | 'degraded' | 'unconfigured' | 'offline'
  >('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const check = useCallback(async () => {
    setState('checking');
    const started = performance.now();
    try {
      const response = await fetch(statusUrl, { cache: 'no-store' });
      const body = (await response.json()) as McpServerStatus;
      setLatency(Math.round(performance.now() - started));
      setStatus(body);
      setState(
        body.status === 'ok' ? 'online' : body.status === 'degraded' ? 'degraded' : 'unconfigured',
      );
    } catch {
      setLatency(null);
      setState('offline');
    }
  }, [statusUrl]);
  useEffect(() => {
    // Poll the external status endpoint once on mount.
    void check();
  }, [check]);
  const pill =
    state === 'online'
      ? { label: 'Online', tone: 'income' as const }
      : state === 'checking'
        ? { label: 'Checking…', tone: 'neutral' as const }
        : state === 'degraded'
          ? { label: 'Degraded', tone: 'warning' as const }
          : state === 'unconfigured'
            ? { label: 'Not configured', tone: 'warning' as const }
            : { label: 'Unreachable', tone: 'destructive' as const };
  return (
    <HeroCard tone={state === 'online' ? 'accent' : 'neutral'} className="mcp-status-card">
      <div className="mcp-status-head">
        <div>
          <p className="mcp-eyebrow">SERVER STATUS</p>
          <h3>FinApp MCP server</h3>
        </div>
        <div className="mcp-status-actions" aria-live="polite">
          <StatusPill label={pill.label} tone={pill.tone} />
          <button
            type="button"
            className="mcp-icon-button"
            onClick={() => void check()}
            aria-label="Check server status again"
            disabled={state === 'checking'}
          >
            <ArrowClockwise />
          </button>
        </div>
      </div>
      <code className="mcp-status-endpoint">{status?.endpoint ?? endpoint}</code>
      <div className="mcp-status-stats">
        <StatTile label="Tools" value={status?.toolCount ?? '—'} icon={<Wrench />} />
        <StatTile
          label="Widgets"
          value={status?.widgetCount ?? '—'}
          icon={<Browsers />}
          tone="split"
        />
        <StatTile
          label="Response"
          value={latency === null ? '—' : `${latency} ms`}
          icon={<Lightning />}
          tone="settlement"
        />
      </div>
      <p className="mcp-status-foot">
        Streamable HTTP · OAuth 2.1 with PKCE{status?.version ? ` · v${status.version}` : ''}
      </p>
    </HeroCard>
  );
}

// ---------- Client guides ----------

type Guide = {
  name: string;
  monogram: string;
  steps: Array<{ title: string; body: string; copy?: { label: string; value: string } }>;
  link: string;
  linkLabel: string;
};

export function clientGuides(endpoint: string): Record<'chatgpt' | 'claude' | 'other', Guide> {
  return {
    chatgpt: {
      name: 'ChatGPT',
      monogram: 'G',
      steps: [
        {
          title: 'Turn on Developer mode',
          body: 'In ChatGPT open Settings → Apps & Connectors → Advanced settings and enable Developer mode. Workspace admins may need to allow custom connectors.',
        },
        {
          title: 'Create the connector',
          body: 'Back in Apps & Connectors choose Create. Name it FinApp and paste the connector URL. Leave authentication on OAuth.',
          copy: { label: 'Copy URL', value: endpoint },
        },
        {
          title: 'Sign in and approve',
          body: 'ChatGPT opens FinApp. Sign in, review the requested permissions and approve. Add write access only if you want ChatGPT to make changes.',
        },
        {
          title: 'Use it in a chat',
          body: 'Start a new chat, open the + menu → Developer mode and enable FinApp. Try “Show my FinApp overview”.',
          copy: { label: 'Copy prompt', value: 'Show my FinApp overview for this month.' },
        },
      ],
      link: 'https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt',
      linkLabel: 'OpenAI help: Developer mode',
    },
    claude: {
      name: 'Claude',
      monogram: 'C',
      steps: [
        {
          title: 'Open Connectors',
          body: 'In Claude (web or desktop) open Settings → Connectors. On Team and Enterprise plans an owner adds it under organisation settings first.',
        },
        {
          title: 'Add a custom connector',
          body: 'Choose Add custom connector, name it FinApp and paste the remote MCP server URL. Leave the OAuth fields empty — FinApp registers the client automatically.',
          copy: { label: 'Copy URL', value: endpoint },
        },
        {
          title: 'Connect and approve',
          body: 'Select Connect next to FinApp, sign in to FinApp and approve the permissions you want Claude to have.',
        },
        {
          title: 'Use it in a chat',
          body: 'Enable FinApp from the tools menu in the message box, then ask “Who owes me in my trip group?”.',
          copy: {
            label: 'Copy prompt',
            value: 'Who owes me in my FinApp groups? Show the balances.',
          },
        },
      ],
      link: 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp',
      linkLabel: 'Claude help: custom connectors',
    },
    other: {
      name: 'Other MCP client',
      monogram: '+',
      steps: [
        {
          title: 'Add a remote server',
          body: 'Add a Streamable HTTP server. The client must support the MCP authorization flow (OAuth 2.1, dynamic client registration and PKCE).',
          copy: { label: 'Copy URL', value: endpoint },
        },
        {
          title: 'Authorize',
          body: 'Your client discovers FinApp’s authorization server from the protected-resource metadata and opens the sign-in page.',
        },
        {
          title: 'Discover tools',
          body: 'Call finapp.catalog first. Clients that support MCP Apps also render FinApp’s in-chat widgets.',
        },
      ],
      link: 'https://modelcontextprotocol.io/docs/develop/connect-remote-servers',
      linkLabel: 'MCP docs: remote servers',
    },
  };
}

export function ConnectGuide({
  endpoint,
  signedIn,
  connectHref,
}: {
  endpoint: string;
  signedIn: boolean;
  connectHref: string;
}) {
  const guides = useMemo(() => clientGuides(endpoint), [endpoint]);
  const [client, setClient] = useState<keyof typeof guides>('chatgpt');
  const guide = guides[client];
  return (
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
      <div className="mcp-endpoint-control">
        <code tabIndex={0}>{endpoint}</code>
        <CopyButton value={endpoint} label="Copy URL" primary />
      </div>
      <fieldset className="mcp-client-picker">
        <legend>Choose your AI client</legend>
        {(Object.keys(guides) as Array<keyof typeof guides>).map((key) => (
          <label key={key} className={client === key ? 'is-selected' : ''}>
            <input
              type="radio"
              name="mcp-client"
              value={key}
              checked={client === key}
              onChange={() => setClient(key)}
            />
            <span className="mcp-client-monogram" aria-hidden="true">
              {guides[key].monogram}
            </span>
            <strong>{guides[key].name}</strong>
            <span className="mcp-radio-dot" />
          </label>
        ))}
      </fieldset>
      <ol className="mcp-setup-steps" aria-label={`Connect to ${guide.name}`}>
        {guide.steps.map((step, index) => (
          <li key={`${client}-${step.title}`}>
            <span className="mcp-step-number">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.copy ? (
                <div className="mcp-step-copy">
                  {step.copy.label === 'Copy URL' ? null : <q>{step.copy.value}</q>}
                  <CopyButton value={step.copy.value} label={step.copy.label} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mcp-guide-links">
        <a href={guide.link} target="_blank" rel="noreferrer" className="mcp-inline-link">
          {guide.linkLabel} <ArrowUpRight />
        </a>
        {!signedIn ? (
          <a className="mcp-inline-link" href={connectHref}>
            Sign in to FinApp first <ArrowUpRight />
          </a>
        ) : null}
      </div>
    </section>
  );
}

// ---------- Tool catalog ----------

const domainLabels: Record<McpCatalogEntry['domain'], string> = {
  finance: 'Finance',
  groups: 'Groups',
  social: 'People',
  personal: 'Settings',
};

export function ToolCatalog({ catalog }: { catalog: McpCatalogEntry[] }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<'all' | McpCatalogEntry['domain']>('all');
  const [access, setAccess] = useState<'all' | 'read' | 'write'>('all');
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = catalog.filter(
    (tool) =>
      (domain === 'all' || tool.domain === domain) &&
      (access === 'all' || (access === 'read') === tool.readOnly) &&
      terms.every((term) =>
        `${tool.name} ${tool.title} ${tool.description}`.toLowerCase().includes(term),
      ),
  );
  const counts = catalog.reduce<Record<string, number>>((all, tool) => {
    all[tool.domain] = (all[tool.domain] ?? 0) + 1;
    return all;
  }, {});
  return (
    <section className="mcp-explorer">
      <div className="mcp-section-heading">
        <div>
          <p className="mcp-eyebrow">EVERY TOOL, DESCRIBED</p>
          <h2>
            {catalog.length} tools.
            <br />
            One permission screen.
          </h2>
        </div>
        <p>
          Reads need only “Read data”. Each write tool names the permission it needs, and
          destructive ones always ask the AI to confirm with you first.
        </p>
      </div>
      <label className="mcp-search">
        <MagnifyingGlass />
        <span className="mcp-sr-only">Search tools</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools — balances, line items, budgets…"
        />
      </label>
      <div className="mcp-catalog-filters" role="group" aria-label="Filter tools">
        {(['all', 'finance', 'groups', 'social', 'personal'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="mcp-chip"
            aria-pressed={domain === value}
            onClick={() => setDomain(value)}
          >
            {value === 'all' ? 'All' : domainLabels[value]}
            <span>{value === 'all' ? catalog.length : (counts[value] ?? 0)}</span>
          </button>
        ))}
        <span className="mcp-chip-divider" aria-hidden="true" />
        {(['all', 'read', 'write'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="mcp-chip"
            aria-pressed={access === value}
            onClick={() => setAccess(value)}
          >
            {value === 'all' ? 'Any access' : value === 'read' ? 'Read only' : 'Makes changes'}
          </button>
        ))}
      </div>
      <p className="mcp-sr-only" role="status">
        {visible.length} matching tools
      </p>
      {visible.length === 0 ? (
        <div className="mcp-empty-state">
          <Illustration scene="search" size={150} />
          <h3>No tools match.</h3>
          <p>Try another word, or clear the filters.</p>
          <button
            type="button"
            className="mcp-button"
            onClick={() => {
              setQuery('');
              setDomain('all');
              setAccess('all');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mcp-tool-list">
          {visible.map((tool) => (
            <li key={tool.name} className="mcp-tool-row">
              <IconTile
                tone={tool.destructive ? 'destructive' : tool.readOnly ? 'accent' : 'settlement'}
                size={36}
              >
                {tool.readOnly ? <ShieldCheck /> : <PencilSimple />}
              </IconTile>
              <div className="mcp-tool-body">
                <div className="mcp-tool-title">
                  <strong>{tool.title}</strong>
                  <StatusPill
                    label={scopeNames[tool.scope] ?? tool.scope}
                    tone={tool.readOnly ? 'neutral' : 'settlement'}
                  />
                  {tool.destructive ? (
                    <StatusPill label="Asks to confirm" tone="destructive" />
                  ) : null}
                  {tool.widget ? (
                    <StatusPill label={`Widget: ${tool.widget.title}`} tone="split" />
                  ) : null}
                </div>
                <p>{tool.description}</p>
                <code>{tool.name}</code>
              </div>
              <CopyButton value={tool.name} label="Copy name" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Widget previews (real widget HTML in a sandboxed frame) ----------

function WidgetFrame({ preview, theme }: { preview: McpWidgetPreview; theme: 'light' | 'dark' }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const target = () => frame.current?.contentWindow ?? null;
    const reply = (id: unknown, payload: Record<string, unknown>) =>
      target()?.postMessage({ jsonrpc: '2.0', id, ...payload }, '*');
    function onMessage(event: MessageEvent) {
      if (event.source !== target()) return;
      const message = event.data as {
        jsonrpc?: string;
        id?: unknown;
        method?: string;
        params?: { height?: number };
      };
      if (message?.jsonrpc !== '2.0' || !message.method) return;
      if (message.method === 'ui/initialize') {
        reply(message.id, {
          result: {
            protocolVersion: '2026-01-26',
            hostInfo: { name: 'finapp-dashboard-preview', version: '1.0.0' },
            hostCapabilities: {},
            hostContext: { theme, displayMode: 'inline' },
          },
        });
      } else if (message.method === 'ui/notifications/initialized') {
        target()?.postMessage(
          {
            jsonrpc: '2.0',
            method: 'ui/notifications/tool-result',
            params: { content: [], structuredContent: { data: preview.sample } },
          },
          '*',
        );
        setReady(true);
      } else if (message.method === 'ui/notifications/size-changed') {
        const next = Number(message.params?.height);
        if (Number.isFinite(next) && next > 0) setHeight(Math.min(900, Math.max(160, next)));
      } else if (message.id !== undefined) {
        reply(message.id, {
          error: {
            code: -32000,
            message: 'Preview only — connect FinApp to an AI client to use actions.',
          },
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [preview.sample, theme]);
  return (
    <div className="mcp-widget-frame">
      {!ready ? (
        <div className="mcp-widget-loading">
          <ListSkeleton rows={3} />
        </div>
      ) : null}
      <iframe
        key={theme}
        ref={frame}
        title={`${preview.title} widget preview`}
        srcDoc={preview.html}
        sandbox="allow-scripts"
        style={{ height }}
        loading="lazy"
      />
    </div>
  );
}

export function WidgetGallery({
  previews,
  theme,
}: {
  previews: McpWidgetPreview[];
  theme: 'light' | 'dark';
}) {
  const [active, setActive] = useState(previews[0]?.id ?? '');
  const preview = previews.find((item) => item.id === active) ?? previews[0];
  if (!preview) return null;
  return (
    <section className="mcp-widgets">
      <div className="mcp-section-heading">
        <div>
          <p className="mcp-eyebrow">IN-CHAT WIDGETS</p>
          <h2>
            Answers you can
            <br />
            tap on.
          </h2>
        </div>
        <p>
          In ChatGPT and Claude these cards render right in the conversation (MCP Apps). Other
          clients get the same data as text. Previews below use sample data.
        </p>
      </div>
      <div className="mcp-widget-layout">
        <div className="mcp-domain-list" role="tablist" aria-label="Widgets">
          {previews.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={item.id === preview.id}
              className={item.id === preview.id ? 'is-selected' : ''}
              onClick={() => setActive(item.id)}
            >
              <Browsers weight="light" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.toolName}</small>
              </span>
            </button>
          ))}
        </div>
        <article className="mcp-widget-detail" role="tabpanel" aria-label={preview.title}>
          <p>{preview.description}</p>
          <WidgetFrame key={preview.id} preview={preview} theme={theme} />
        </article>
      </div>
    </section>
  );
}
