import { createKit } from './kit';
import { widgetRuntime } from './runtime';
import { widgetCss } from './styles';
import type { WidgetDefinition } from './types';

/** MCP Apps UI resource MIME type (SEP-1865, supported by Claude and ChatGPT). */
export const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * Source of a function usable as an expression. Method shorthand (`render(d, k) {…}`) is turned
 * into a function expression; arrows and `function` sources are returned as is.
 */
export function functionSource(fn: (...args: never[]) => unknown): string {
  const source = fn.toString().trim();
  if (/^(async\s+)?(function\b|\(|[A-Za-z_$][\w$]*\s*=>)/.test(source)) return source;
  return `function ${source}`;
}

/** JSON safe inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) => (typeof v === 'bigint' ? v.toString() : v))
    .replace(/</g, '\\u003c')
    .replace(new RegExp('\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\u2029', 'g'), '\\u2029');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The widget's client script: kit, renders (the widget plus its `views`), empty data and the
 * runtime. `lookup` resolves view ids to definitions.
 */
export function widgetScript(
  widget: WidgetDefinition,
  lookup: (id: string) => WidgetDefinition | undefined,
): string {
  const views = [widget, ...(widget.views ?? []).map(lookup).filter(Boolean)] as WidgetDefinition[];
  const parts = [
    // Guards against bundler name-keeping helpers leaking into serialized functions.
    'var __name = function (f) { return f; };',
    `var KIT = (${functionSource(createKit)})();`,
    'var VIEWS = {};',
    ...views.map((view) => `VIEWS[${scriptJson(view.id)}] = (${functionSource(view.render)});`),
    `var WIDGET = ${scriptJson({ id: widget.id, title: widget.title })};`,
    `var EMPTY = ${scriptJson(widget.empty)};`,
    widgetRuntime,
  ];
  return parts.join('\n').replace(/<\/(script)/gi, '<\\/$1');
}

export type DocumentOptions = {
  /** Pre-render this data on the server and hand it to the runtime (gallery/previews). */
  sample?: unknown;
  theme?: 'light' | 'dark';
  /** Server-rendered body (skips waiting for the runtime). */
  body?: string;
};

export function widgetDocument(
  widget: WidgetDefinition,
  lookup: (id: string) => WidgetDefinition | undefined,
  options: DocumentOptions = {},
): string {
  const theme = options.theme ? ` data-theme="${options.theme}"` : '';
  const sample =
    options.sample === undefined
      ? ''
      : `<script>window.__FINAPP_SAMPLE__ = ${scriptJson(options.sample)};</script>\n`;
  return `<!doctype html>
<html lang="en"${theme}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FinApp · ${escapeHtml(widget.title)}</title>
<style>${widgetCss}</style>
</head>
<body data-widget="${escapeHtml(widget.id)}">
<main id="app" aria-live="polite">${options.body ?? ''}</main>
${sample}<script>${widgetScript(widget, lookup)}</script>
</body>
</html>`;
}
