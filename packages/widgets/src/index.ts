import { createKit, type Kit } from './kit';
import { WIDGET_MIME_TYPE, widgetDocument, type DocumentOptions } from './shell';
import { widgetForTool } from './tools';
import type { WidgetDefinition, WidgetDomain } from './types';
import { allWidgets } from './widgets';

export { createKit, WIDGET_MIME_TYPE, widgetForTool };
export { widgetCss } from './styles';
export { functionSource, widgetScript } from './shell';
export { defineWidget } from './types';
export type { Kit, DocumentOptions, WidgetDefinition, WidgetDomain };
export type { Minor, WidgetInput, WidgetRender, WidgetUri } from './types';

/** Any registered widget id (validated at runtime; the registry is the source of truth). */
export type WidgetId = string;

const byId = new Map<string, WidgetDefinition>();
const byUri = new Map<string, WidgetDefinition>();
for (const widget of allWidgets) {
  if (byId.has(widget.id)) throw new Error(`Duplicate widget id: ${widget.id}`);
  if (byUri.has(widget.uri)) throw new Error(`Duplicate widget URI: ${widget.uri}`);
  byId.set(widget.id, widget);
  byUri.set(widget.uri, widget);
}

/** Every widget, in catalog order (domain by domain). */
export function listWidgets(): WidgetDefinition[] {
  return allWidgets.slice();
}

export function getWidget(id: WidgetId): WidgetDefinition | undefined {
  return byId.get(id);
}

export function requireWidget(id: WidgetId): WidgetDefinition {
  const widget = byId.get(id);
  if (!widget) throw new Error(`Unknown widget: ${id}`);
  return widget;
}

export function widgetByUri(uri: string): WidgetDefinition | undefined {
  return byUri.get(uri);
}

/** The widget linked to a tool, if any. */
export function widgetIdForTool(toolName: string): WidgetId | undefined {
  const id = widgetForTool[toolName];
  return id && byId.has(id) ? id : undefined;
}

/** The self-contained HTML resource served at the widget's `ui://` URI. */
export function widgetHtml(id: WidgetId, options?: DocumentOptions): string {
  return widgetDocument(requireWidget(id), getWidget, options);
}

let serverKit: Kit | null = null;
/** Server-side render of a widget fragment (tests, gallery). `null` data renders the empty state. */
export function renderWidget(id: WidgetId, data?: unknown): string {
  const widget = requireWidget(id);
  serverKit ??= createKit();
  return widget.render(data === null || data === undefined ? widget.empty : data, serverKit);
}

/** A full static document with the sample pre-rendered (also hydrated by the runtime). */
export function renderWidgetDocument(
  id: WidgetId,
  data: unknown,
  theme?: 'light' | 'dark',
): string {
  return widgetHtml(id, { sample: data, theme, body: renderWidget(id, data) });
}

/**
 * Widgets load nothing from the network: no scripts, styles, fonts or API calls (all data
 * arrives through the host bridge), so the CSP allow-lists are empty.
 */
export function widgetResourceMeta(widget: WidgetDefinition) {
  return {
    ui: {
      csp: { connectDomains: [] as string[], resourceDomains: [] as string[] },
      prefersBorder: true,
    },
    'openai/widgetDescription': widget.description,
    'openai/widgetPrefersBorder': true,
    'openai/widgetCSP': { connect_domains: [] as string[], resource_domains: [] as string[] },
  };
}

/** Tool `_meta` linking a tool to its widget (MCP Apps key plus the ChatGPT aliases). */
export function widgetToolMeta(id: WidgetId) {
  const widget = requireWidget(id);
  return {
    ui: { resourceUri: widget.uri },
    'openai/outputTemplate': widget.uri,
    'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': widget.invoking,
    'openai/toolInvocation/invoked': widget.invoked,
  };
}

export const WIDGET_DOMAINS: readonly WidgetDomain[] = [
  'core',
  'balances',
  'accounts',
  'transactions',
  'spending',
  'income',
  'cashflow',
  'categories',
  'goals',
  'recurring',
  'groups',
  'people',
  'chats',
  'notifications',
  'trash',
  'insights',
  'finai',
  'settings',
  'security',
];
