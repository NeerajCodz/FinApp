import { describe, expect, it } from 'vitest';
import { arcPath, barPath, linePath, niceTicks } from '@finapp/ui/charts/core';
import {
  WIDGET_MIME_TYPE,
  createKit,
  getWidget,
  listWidgets,
  renderWidget,
  widgetByUri,
  widgetForTool,
  widgetHtml,
  widgetIdForTool,
  widgetResourceMeta,
  widgetScript,
  widgetToolMeta,
} from '@finapp/widgets';
import { toolCatalog } from '@finapp/mcp/server';

const widgets = listWidgets();
const LEGACY_URIS: Record<string, string> = {
  overview: 'ui://finapp/overview.v1.html',
  transactions: 'ui://finapp/transactions.v1.html',
  groupBalances: 'ui://finapp/group-balances.v1.html',
  expense: 'ui://finapp/expense.v1.html',
  settleUp: 'ui://finapp/settle-up.v1.html',
};
const EXTERNAL_URL = /https?:\/\//i;

/** Evaluates the serialized kit and renders exactly as the browser does (no DOM needed). */
function clientViews(id: string) {
  const widget = getWidget(id)!;
  const script = widgetScript(widget, getWidget);
  const head = script.slice(0, script.indexOf('(function () {'));
  // A fresh function scope: the serialized code may only use globals and what it defines.
  return new Function(`${head}\nreturn { KIT: KIT, VIEWS: VIEWS, EMPTY: EMPTY };`)() as {
    KIT: ReturnType<typeof createKit>;
    VIEWS: Record<string, (data: unknown, kit: unknown) => string>;
    EMPTY: unknown;
  };
}

const NAME_KEYS = new Set([
  'name',
  'title',
  'displayName',
  'merchant',
  'label',
  'note',
  'text',
  'body',
  'description',
  'groupName',
  'senderName',
  'fromName',
  'toName',
  'categoryName',
  'accountName',
  'subtitle',
  'summary',
  'question',
  'answer',
  'reason',
  'detail',
  'person',
  'group',
  'goal',
  'client',
  'category',
  'paidBy',
  'actor',
  'account',
  'place',
  'method',
  'employer',
  'location',
  'tag',
]);
const XSS = '<script>alert(1)</script><img src=x onerror=alert(1)>';

function poison(value: unknown, key = ''): unknown {
  if (typeof value === 'string') return NAME_KEYS.has(key) ? XSS + value : value;
  if (Array.isArray(value)) {
    // Arrays of plain strings (labels, tags, names) are user text too.
    return value.map((entry) => (typeof entry === 'string' ? XSS + entry : poison(entry)));
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, poison(v, k)]));
  return value;
}

describe('widget registry', () => {
  it('has at least 150 widgets with unique ids and URIs', () => {
    expect(widgets.length).toBeGreaterThanOrEqual(150);
    expect(new Set(widgets.map((widget) => widget.id)).size).toBe(widgets.length);
    expect(new Set(widgets.map((widget) => widget.uri)).size).toBe(widgets.length);
  });

  it('keeps the original five URIs and names everything else ui://finapp/<domain>.<name>.v<n>.html', () => {
    for (const [id, uri] of Object.entries(LEGACY_URIS)) {
      expect(getWidget(id)?.uri).toBe(uri);
      expect(widgetByUri(uri)?.id).toBe(id);
    }
    for (const widget of widgets) {
      if (LEGACY_URIS[widget.id]) continue;
      expect(widget.id.startsWith(`${widget.domain}.`)).toBe(true);
      expect(widget.uri).toBe(`ui://finapp/${widget.id}.v${widget.version}.html`);
    }
  });

  it('gives every widget a title, description and at least one example', () => {
    for (const widget of widgets) {
      expect(widget.title.length, widget.id).toBeGreaterThan(2);
      expect(widget.description.length, widget.id).toBeGreaterThan(20);
      expect(widget.examples.length, widget.id).toBeGreaterThan(0);
    }
  });

  it('resolves bundled views', () => {
    for (const widget of widgets)
      for (const view of widget.views ?? [])
        expect(getWidget(view), `${widget.id} → ${view}`).toBeDefined();
  });
});

describe.each(widgets.map((widget) => [widget.id]))('%s', (id) => {
  const widget = getWidget(id)!;

  it('renders every example and its empty state', () => {
    for (const example of widget.examples) {
      const html = renderWidget(id, example);
      expect(html.length).toBeGreaterThan(80);
      expect(html).not.toMatch(EXTERNAL_URL);
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
    }
    const empty = renderWidget(id, widget.empty);
    expect(empty.length).toBeGreaterThan(40);
    expect(empty).toContain('data-empty');
    expect(renderWidget(id, null)).toBe(empty);
  });

  it('escapes user-provided strings', () => {
    const poisoned = poison(widget.examples[0]);
    const html = renderWidget(id, poisoned);
    expect(html).not.toMatch(/<script|<img/i);
    // Widgets whose sample carries free text must show it, escaped.
    if (JSON.stringify(poisoned) !== JSON.stringify(widget.examples[0]))
      expect(html).toContain('&lt;script&gt;');
  });

  it('serves a self-contained MCP App document that renders in the client exactly like the server', () => {
    const doc = widgetHtml(id);
    expect(doc).toContain(`data-widget="${id}"`);
    expect(doc).toContain('ui/initialize');
    expect(doc).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//i);
    // The whole client script must at least parse.
    const script = widgetScript(widget, getWidget);
    expect(() => new Function(script)).not.toThrow();
    const client = clientViews(id);
    expect(client.VIEWS[id]!(widget.examples[0], client.KIT)).toBe(
      renderWidget(id, widget.examples[0]),
    );
    expect(client.VIEWS[id]!(client.EMPTY, client.KIT)).toBe(renderWidget(id, widget.empty));
  });
});

describe('tool links', () => {
  const tools = new Set(toolCatalog().map((tool) => tool.name));

  it('maps only existing tools to existing widgets', () => {
    for (const [tool, id] of Object.entries(widgetForTool)) {
      expect(tools.has(tool), tool).toBe(true);
      expect(getWidget(id), id).toBeDefined();
      expect(widgetIdForTool(tool)).toBe(id);
    }
  });

  it('builds MCP Apps and ChatGPT metadata', () => {
    const meta = widgetToolMeta('groupBalances');
    expect(meta).toMatchObject({
      ui: { resourceUri: 'ui://finapp/group-balances.v1.html' },
      'openai/outputTemplate': 'ui://finapp/group-balances.v1.html',
    });
    expect(widgetResourceMeta(getWidget('overview')!).ui.csp).toEqual({
      connectDomains: [],
      resourceDomains: [],
    });
    expect(WIDGET_MIME_TYPE).toBe('text/html;profile=mcp-app');
  });
});

describe('kit', () => {
  const k = createKit();

  it('escapes HTML in text and attributes', () => {
    expect(k.esc(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
    expect(k.row({ title: XSS, tip: '"><script>' })).not.toMatch(/<script|<img/);
  });

  it('formats minor units without float drift and honours currency digits', () => {
    expect(k.money(12345, 'INR')).toBe('₹123.45');
    expect(k.money('-500', 'USD')).toBe('−$5.00');
    expect(k.money(1500, 'JPY')).toBe('¥1,500');
    expect(k.money(1_250_000_00, 'INR', { compact: true })).toBe('₹1.3M');
    expect(
      k.amount({ amountMinor: '100', amountFormatted: '-₹1.00', currency: 'INR' }, 'amount'),
    ).toBe('−₹1.00');
  });

  it('matches the shared chart math in @finapp/ui', () => {
    expect(k.niceTicks(0, 937, 4)).toEqual(niceTicks(0, 937, 4));
    expect(k.niceTicks(-120, 480, 4)).toEqual(niceTicks(-120, 480, 4));
    expect(k.barPath(10, 20, 100, 30)).toBe(barPath(10, 20, 100, 30));
    expect(k.barPath(10, 20, 100, 160)).toBe(barPath(10, 20, 100, 160));
    expect(k.arcPath(50, 50, 50, 30, 0, 1.2)).toBe(arcPath(50, 50, 50, 30, 0, 1.2));
    const pts: Array<[number, number]> = [
      [0, 10],
      [10, 30],
      [20, 5],
      [30, 25],
    ];
    expect(k.linePath(pts)).toBe(linePath(pts.map(([x, y]) => ({ x, y }))));
  });

  it('caps bars at 24px, folds categories past eight into Other and adds hidden data tables', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `C${i}`, value: 100 - i }));
    const folded = k.fold(many);
    expect(folded).toHaveLength(8);
    expect(folded[7]!.label).toBe('Other');
    const donut = k.donut({ items: many, currency: 'INR' });
    expect(donut).toContain('Other');
    expect(donut).not.toContain('var(--s9)');
    const chart = k.columns({ labels: ['A', 'B'], series: [{ name: 'x', values: [1, 2] }] });
    expect(chart).toContain('class="sr-only"');
    for (const match of chart.matchAll(
      /M([\d.]+) [\d.]+V[\d.]+Q[\d.]+ [\d.]+ [\d.]+ [\d.]+H([\d.]+)/g,
    ))
      expect(Number(match[2]) - Number(match[1])).toBeLessThanOrEqual(24);
  });
});
