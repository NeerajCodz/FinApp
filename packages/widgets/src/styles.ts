import { SERIES_DARK, SERIES_LIGHT, neutralColor } from '@finapp/ui/charts/core';

const seriesVars = (palette: readonly string[]) =>
  palette.map((value, index) => `--s${index + 1}: ${value};`).join(' ');

const LIGHT = `
  color-scheme: light;
  --bg: #ffffff; --panel: #f5f5f1; --panel2: #ecece6; --surface: var(--bg);
  --line: rgba(0, 0, 0, 0.1); --grid: rgba(0, 0, 0, 0.08); --track: rgba(0, 0, 0, 0.07);
  --text: #0b0b0b; --muted: #5f5f5a;
  --accent: #3f6b00; --accent-ink: #ffffff; --accent-soft: rgba(63, 107, 0, 0.1); --volt: #b7ff4a;
  --income: #187f43; --expense: #c93f43; --warn: #8a6400;
  --other: ${neutralColor(false)}; ${seriesVars(SERIES_LIGHT)}
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.06);`;

const DARK = `
  color-scheme: dark;
  --bg: #0b0b0b; --panel: #151515; --panel2: #1e1e1e; --surface: var(--bg);
  --line: rgba(255, 255, 255, 0.1); --grid: rgba(255, 255, 255, 0.08); --track: rgba(255, 255, 255, 0.08);
  --text: #f4f4f0; --muted: #a3a39d;
  --accent: #b7ff4a; --accent-ink: #0b0b0b; --accent-soft: rgba(183, 255, 74, 0.12); --volt: #b7ff4a;
  --income: #4ed37a; --expense: #ff6868; --warn: #f5c84b;
  --other: ${neutralColor(true)}; ${seriesVars(SERIES_DARK)}
  --shadow: none;`;

/** Theme tokens: light by default, dark from the host theme or `prefers-color-scheme`. */
export const widgetCss = `
:root {${LIGHT}
  --radius: 16px;
  --font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {${DARK}} }
:root[data-theme='dark'] {${DARK}}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
button, input, select { font: inherit; color: inherit; }
#app { padding: 16px; }
.w { display: grid; gap: 14px; min-width: 0; }
.eyebrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0; }
h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
h2 { font-size: 17px; } h3 { font-size: 13px; color: var(--muted); font-weight: 600; }
.hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.hd-t { min-width: 0; } .hd-a { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.sec { display: grid; gap: 8px; min-width: 0; }
.sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.sec-a { font-size: 12px; color: var(--muted); }
.muted, .sub { color: var(--muted); } .sub { font-size: 12px; }
.pos { color: var(--income); } .neg { color: var(--expense); } .warn { color: var(--warn); } .acc { color: var(--accent); }
.right { text-align: right; }
.note { margin: 0; font-size: 12px; color: var(--muted); }
.grow { flex: 1; min-width: 0; }
.amount { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.ico { flex: none; vertical-align: -3px; }
.card { background: var(--panel); --surface: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; min-width: 0; box-shadow: var(--shadow); position: relative; }
.card[style*='--edge'] { border-left: 3px solid var(--edge); }
.card.flush { padding: 0; overflow: hidden; }
.card.list { padding: 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--min), 100%), 1fr)); gap: 10px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 14px; align-items: start; }
.hero { background: var(--panel); --surface: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; display: grid; gap: 10px; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--accent); }
.hero-t { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.big { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--min), 100%), 1fr)); gap: 8px; }
.stat { background: var(--panel); --surface: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 3px; align-content: start; min-width: 0; }
.stat strong { font-size: 17px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat-f { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.delta { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; font-weight: 500; }
.pill.acc { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
.pill.pos { color: var(--income); border-color: currentColor; } .pill.neg { color: var(--expense); border-color: currentColor; } .pill.warn { color: var(--warn); border-color: currentColor; }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); min-width: 0; }
.row:last-child { border-bottom: 0; }
.row.dim { opacity: 0.6; }
.row .title, .brow .title, .meter .title { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val { display: grid; justify-items: end; gap: 1px; text-align: right; }
.tile { width: var(--sz); height: var(--sz); border-radius: 11px; display: grid; place-items: center; flex: none; font-weight: 650; font-size: 15px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
.av { width: var(--sz); height: var(--sz); border-radius: 50%; display: inline-grid; place-items: center; flex: none; font-weight: 650; font-size: calc(var(--sz) * 0.38); color: var(--text); background: var(--panel2); border: 1px solid var(--line); }
.av0 { background: color-mix(in srgb, var(--s1) 22%, var(--panel)); } .av1 { background: color-mix(in srgb, var(--s2) 22%, var(--panel)); }
.av2 { background: color-mix(in srgb, var(--s3) 22%, var(--panel)); } .av3 { background: color-mix(in srgb, var(--s4) 22%, var(--panel)); }
.av4 { background: color-mix(in srgb, var(--s5) 22%, var(--panel)); } .av5 { background: color-mix(in srgb, var(--s7) 22%, var(--panel)); }
.stack { display: inline-flex; } .stack .av { margin-left: -6px; border: 2px solid var(--surface); } .stack .av:first-child { margin-left: 0; }
.track { position: relative; height: 8px; border-radius: 0 4px 4px 0; background: var(--track); overflow: visible; }
.track > i { display: block; height: 100%; border-radius: 0 4px 4px 0; max-width: 100%; }
.track > b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); border-radius: 1px; }
.track.thin { height: 6px; }
.meter { display: grid; gap: 6px; padding: 8px 0; }
.meter-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bars { display: grid; gap: 10px; }
.brow { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brow-h { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.hbar { height: 10px; background: var(--track); border-radius: 0 4px 4px 0; }
.hbar > i { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.seg { display: flex; gap: 2px; height: 14px; border-radius: 0 4px 4px 0; overflow: hidden; }
.seg > i { display: block; min-width: 3px; }
.seg > i:first-child { border-radius: 0; } .seg > i:last-child { border-radius: 0 4px 4px 0; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--muted); align-items: center; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 3px; background: var(--c); display: inline-block; }
.legend i.dash { height: 2px; border-radius: 0; background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 7px); width: 14px; }
.legend b { color: var(--text); font-weight: 600; }
.legend.scale { gap: 3px; } .legend.scale i { width: 12px; height: 12px; }
.fig { margin: 0; display: grid; gap: 8px; min-width: 0; }
.chart { display: block; overflow: visible; }
.chart .grid { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
.chart .grid.zero { stroke: var(--line); }
.chart .ref { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 4; }
.chart .ax { fill: var(--muted); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.chart .hit { fill: transparent; }
.chart .hit:hover { fill: var(--text); fill-opacity: 0.04; }
.chart path[data-tip]:hover, .chart rect[data-tip]:not(.hit):hover { opacity: 0.8; }
.spark { display: block; }
.sparkb { display: flex; align-items: flex-end; justify-content: space-between; gap: 4px; height: var(--h); }
.sparkb i { flex: 1; max-width: 24px; border-radius: 4px 4px 0 0; min-height: 2px; }
.donut { margin: 0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.donut-c { position: relative; width: var(--sz); height: var(--sz); flex: none; }
.donut-c svg { display: block; }
.donut-t { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 2px; pointer-events: none; }
.donut-t strong { font-size: 18px; font-variant-numeric: tabular-nums; }
.lg-t { flex: 1; min-width: 180px; border-collapse: collapse; font-size: 13px; }
.lg-t td { padding: 4px 0; border-bottom: 1px solid var(--line); }
.lg-t tr:last-child td { border-bottom: 0; }
.lg-t td:nth-child(2) { text-align: right; padding: 4px 10px; }
.lg-t i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; background: var(--c); margin-right: 8px; vertical-align: -1px; }
.ring { margin: 0; display: inline-grid; justify-items: center; gap: 6px; position: relative; }
.ring svg { display: block; }
.ring-c { position: absolute; top: 0; left: 0; width: var(--sz); height: var(--sz); display: grid; place-content: center; text-align: center; }
.ring-c strong { font-size: calc(var(--sz) * 0.2); font-variant-numeric: tabular-nums; }
.cal { margin: 0; }
.cal-g { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-w { font-size: 11px; color: var(--muted); text-align: center; padding-bottom: 2px; }
.cal-d { aspect-ratio: 1 / 0.82; border-radius: 8px; background: color-mix(in srgb, var(--s1) calc(var(--a, 0) * 100%), var(--panel)); border: 1px solid var(--line); padding: 4px 5px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
.cal-d.pad { background: transparent; border-color: transparent; }
.cal-d.today { outline: 2px solid var(--accent); outline-offset: -1px; }
.cal-n { font-size: 11px; font-variant-numeric: tabular-nums; }
.cal-m { display: flex; gap: 2px; flex-wrap: wrap; } .cal-m i { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
.kv { margin: 0; display: grid; gap: 0; }
.kv > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.kv > div:last-child { border-bottom: 0; }
.kv dt { color: var(--muted); } .kv dd { margin: 0; text-align: right; font-weight: 550; min-width: 0; overflow-wrap: anywhere; }
.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; padding: 8px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.tbl td { padding: 8px 12px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl .right { text-align: right; } .tbl .center { text-align: center; }
.tl { list-style: none; margin: 0; padding: 0; display: grid; }
.tl li { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; position: relative; }
.tl li:not(:last-child)::after { content: ''; position: absolute; left: 9px; top: 28px; bottom: -4px; width: 2px; background: var(--line); }
.tl-dot { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--panel)); border: 2px solid var(--c); }
.tl time { white-space: nowrap; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.steps li { display: flex; gap: 10px; align-items: flex-start; }
.steps .dot { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--line); display: grid; place-items: center; flex: none; }
.steps li.done .dot { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.msg { display: flex; gap: 8px; align-items: flex-end; max-width: 86%; }
.msg.mine { margin-left: auto; flex-direction: row-reverse; }
.bub { background: var(--panel); border: 1px solid var(--line); padding: 8px 11px; border-radius: 14px 14px 14px 4px; display: grid; gap: 2px; overflow-wrap: anywhere; }
.msg.mine .bub { background: var(--accent-soft); border-color: transparent; border-radius: 14px 14px 4px 14px; }
.thread { display: grid; gap: 8px; }
.rcpt { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; font-variant-numeric: tabular-nums; display: grid; gap: 10px; }
.rcpt-h { display: grid; gap: 2px; text-align: center; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
.rcpt-l, .rcpt-t { display: grid; gap: 6px; }
.rcpt-l > div, .rcpt-t > div { display: flex; justify-content: space-between; gap: 12px; }
.rcpt-l > div > span:first-child { display: grid; }
.rcpt-t { padding-top: 10px; border-top: 1px dashed var(--line); }
.rcpt-t .strong { font-weight: 700; font-size: 15px; }
.rcpt-f { text-align: center; }
.sw { width: 34px; height: 20px; border-radius: 999px; background: var(--track); position: relative; flex: none; border: 1px solid var(--line); }
.sw i { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--muted); }
.sw.on { background: var(--accent); } .sw.on i { left: 16px; background: var(--accent-ink); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.btn { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 6px 12px; cursor: pointer; font-weight: 550; font-size: 13px; }
.btn:hover { border-color: var(--accent); }
.btn.primary { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
.btn:disabled { opacity: 0.55; cursor: progress; }
.btn:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.field { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
.field input, .field select { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; font-size: 14px; color: var(--text); }
.choice { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.choice:last-child { border-bottom: 0; }
.choice input { accent-color: var(--accent); }
.notice { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); }
.empty { text-align: center; padding: 26px 12px; color: var(--muted); display: grid; gap: 6px; justify-items: center; border: 1px dashed var(--line); border-radius: var(--radius); }
.empty strong { color: var(--text); font-weight: 600; }
.empty p { margin: 0; font-size: 13px; max-width: 36ch; }
.empty-i { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.skeleton { height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--panel), var(--line), var(--panel)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
#fa-tip { position: fixed; z-index: 10; pointer-events: none; background: var(--text); color: var(--bg); font-size: 12px; line-height: 1.45; padding: 6px 9px; border-radius: 8px; white-space: pre-line; max-width: 260px; font-variant-numeric: tabular-nums; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); }
.items { margin: 0 0 10px 44px; padding: 8px 10px; border-left: 2px solid var(--accent); display: grid; gap: 4px; font-size: 13px; }
.items > div { display: flex; justify-content: space-between; gap: 8px; }
details.tx > summary { list-style: none; cursor: pointer; }
details.tx > summary::-webkit-details-marker { display: none; }
details.tx:not(:last-child) { border-bottom: 1px solid var(--line); }
details.tx .row { border-bottom: 0; }
.card.list > details.tx + .row, .card.list > .row + details.tx { border-top: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
