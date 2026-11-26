/**
 * Writes a static gallery of every widget rendered with its sample data (and its empty state)
 * to packages/widgets/preview/index.html. Run: `bun run --cwd packages/widgets preview`.
 *
 * Each widget renders inside an iframe using its real resource document (same CSS and markup an
 * MCP host shows) as a static snapshot; the browser path itself is covered by tests/widgets.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIDGET_DOMAINS, listWidgets, renderWidget, widgetForTool, widgetHtml } from '../src/index';

/** Gallery frames are static snapshots; this restores hover tooltips without the full runtime. */
const tooltipScript = `(function () {
  var tip = document.createElement('div'); tip.id = 'fa-tip'; tip.style.display = 'none'; document.body.appendChild(tip);
  document.addEventListener('pointermove', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) { tip.style.display = 'none'; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.style.display = 'block';
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 6, e.clientX + 12) + 'px';
    tip.style.top = (e.clientY - tip.offsetHeight - 10 < 4 ? e.clientY + 16 : e.clientY - tip.offsetHeight - 10) + 'px';
  });
})();`;

const snapshot = (id: string, data: unknown, theme: 'light' | 'dark') =>
  widgetHtml(id, { theme, body: renderWidget(id, data), staticScript: tooltipScript });

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'preview');
mkdirSync(outDir, { recursive: true });

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const toolsFor = (id: string) =>
  Object.entries(widgetForTool)
    .filter(([, widget]) => widget === id)
    .map(([tool]) => tool);

const widgets = listWidgets();
const sections = WIDGET_DOMAINS.map((domain) => {
  const list = widgets.filter((widget) => widget.domain === domain);
  if (!list.length) return '';
  const cards = list
    .map((widget) => {
      const tools = toolsFor(widget.id);
      const frames = (['dark', 'light'] as const)
        .map(
          (theme) =>
            `<iframe class="t-${theme}" title="${escape(widget.title)} (${theme})" loading="lazy" sandbox="allow-scripts" srcdoc="${escape(
              snapshot(widget.id, widget.examples[0], theme),
            )}"></iframe>`,
        )
        .join('');
      const emptyFrame = `<iframe class="empty-f" title="${escape(widget.title)} (empty)" loading="lazy" sandbox="allow-scripts" srcdoc="${escape(
        snapshot(widget.id, widget.empty, 'dark'),
      )}"></iframe>`;
      return `<article id="${escape(widget.id)}">
  <header><h3>${escape(widget.title)}</h3><code>${escape(widget.uri)}</code></header>
  <p>${escape(widget.description)}</p>
  ${tools.length ? `<p class="tools">Linked: ${tools.map((tool) => `<code>${escape(tool)}</code>`).join(' ')}</p>` : ''}
  <div class="frames">${frames}</div>
  <details><summary>Empty state</summary>${emptyFrame}</details>
</article>`;
    })
    .join('\n');
  return `<section><h2 id="d-${domain}">${domain} <small>${list.length}</small></h2><div class="cards">${cards}</div></section>`;
}).join('\n');

const nav = WIDGET_DOMAINS.map((domain) => {
  const count = widgets.filter((widget) => widget.domain === domain).length;
  return count ? `<a href="#d-${domain}">${domain} <small>${count}</small></a>` : '';
}).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FinApp widget gallery</title>
<style>
  :root { color-scheme: dark; --bg: #0b0b0b; --panel: #151515; --line: rgba(255,255,255,.1); --text: #f4f4f0; --muted: #a3a39d; --accent: #b7ff4a; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; }
  .top { position: sticky; top: 0; z-index: 2; background: rgba(11,11,11,.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .top h1 { font-size: 16px; margin: 0 12px 0 0; } .top h1 b { color: var(--accent); }
  .top a { color: var(--muted); text-decoration: none; font-size: 13px; } .top a:hover { color: var(--accent); }
  .top label { margin-left: auto; font-size: 13px; color: var(--muted); }
  main { padding: 20px; display: grid; gap: 32px; }
  h2 { text-transform: capitalize; font-size: 20px; margin: 0 0 12px; } small { color: var(--muted); font-weight: 400; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 560px), 1fr)); gap: 16px; }
  article { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 14px; display: grid; gap: 8px; align-content: start; }
  article header { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; }
  article h3 { margin: 0; font-size: 15px; } article p { margin: 0; color: var(--muted); font-size: 13px; }
  code { font-size: 11.5px; color: var(--accent); }
  iframe { width: 100%; height: 520px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
  .frames { display: grid; gap: 8px; }
  body.only-dark .t-light, body.only-light .t-dark { display: none; }
  details summary { cursor: pointer; color: var(--muted); font-size: 13px; }
  .empty-f { height: 260px; margin-top: 8px; }
</style>
</head>
<body class="only-dark">
<div class="top"><h1>FinApp <b>widgets</b> · ${widgets.length}</h1>${nav}
<label>Theme <select id="theme"><option value="only-dark">Dark</option><option value="only-light">Light</option><option value="">Both</option></select></label></div>
<main>${sections}</main>
<script>
  document.getElementById('theme').addEventListener('change', function (e) { document.body.className = e.target.value; });
</script>
</body>
</html>`;

const file = join(outDir, 'index.html');
writeFileSync(file, html);
console.log(`Wrote ${widgets.length} widgets to ${file}`);
