import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WidgetId } from '../toolkit';
import { widgetCss, widgetRuntime } from './runtime';

/** MCP Apps UI resource MIME type (SEP-1865, supported by Claude and ChatGPT). */
export const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

export type WidgetDefinition = {
  id: WidgetId;
  /** Versioned so hosts that cache by URI pick up breaking template changes. */
  uri: `ui://finapp/${string}`;
  title: string;
  description: string;
  invoking: string;
  invoked: string;
};

export const widgets: Record<WidgetId, WidgetDefinition> = {
  overview: {
    id: 'overview',
    uri: 'ui://finapp/overview.v1.html',
    title: 'Financial overview',
    description:
      'Net, income and spending for the period, account balances and category limit usage.',
    invoking: 'Gathering your accounts…',
    invoked: 'Overview ready',
  },
  transactions: {
    id: 'transactions',
    uri: 'ui://finapp/transactions.v1.html',
    title: 'Transactions',
    description: 'A transaction list with expandable line items.',
    invoking: 'Searching transactions…',
    invoked: 'Transactions ready',
  },
  groupBalances: {
    id: 'groupBalances',
    uri: 'ui://finapp/group-balances.v1.html',
    title: 'Group balances',
    description: 'Who owes whom in a group, with suggested transfers, reminders and settle-up.',
    invoking: 'Working out balances…',
    invoked: 'Balances ready',
  },
  expense: {
    id: 'expense',
    uri: 'ui://finapp/expense.v1.html',
    title: 'Expense detail',
    description: 'One expense with payers, split, line items and edit history.',
    invoking: 'Opening the expense…',
    invoked: 'Expense ready',
  },
  settleUp: {
    id: 'settleUp',
    uri: 'ui://finapp/settle-up.v1.html',
    title: 'Settle up',
    description: 'Pick a suggested transfer and record the settlement from one of your accounts.',
    invoking: 'Preparing settle-up…',
    invoked: 'Ready to settle up',
  },
};

/**
 * Widgets load nothing from the network: no scripts, styles, fonts or API calls (all data
 * arrives through the host bridge), so the CSP allow-lists are empty.
 */
const resourceMeta = (widget: WidgetDefinition) => ({
  ui: {
    csp: { connectDomains: [], resourceDomains: [] },
    prefersBorder: true,
  },
  'openai/widgetDescription': widget.description,
  'openai/widgetPrefersBorder': true,
  'openai/widgetCSP': { connect_domains: [], resource_domains: [] },
});

/** Tool `_meta` linking a tool to its widget (MCP Apps key plus the ChatGPT alias). */
export function widgetToolMeta(id: WidgetId) {
  const widget = widgets[id];
  return {
    ui: { resourceUri: widget.uri },
    'openai/outputTemplate': widget.uri,
    'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': widget.invoking,
    'openai/toolInvocation/invoked': widget.invoked,
  };
}

export function widgetHtml(id: WidgetId): string {
  const widget = widgets[id];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FinApp · ${widget.title}</title>
<style>${widgetCss}</style>
</head>
<body data-widget="${widget.id}">
<main id="app" aria-live="polite"></main>
<script>${widgetRuntime}</script>
</body>
</html>`;
}

export function registerWidgets(server: McpServer) {
  for (const widget of Object.values(widgets)) {
    server.registerResource(
      `finapp-widget-${widget.id}`,
      widget.uri,
      {
        title: widget.title,
        description: widget.description,
        mimeType: WIDGET_MIME_TYPE,
        _meta: resourceMeta(widget),
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: WIDGET_MIME_TYPE,
            text: widgetHtml(widget.id),
            _meta: resourceMeta(widget),
          },
        ],
      }),
    );
  }
}
