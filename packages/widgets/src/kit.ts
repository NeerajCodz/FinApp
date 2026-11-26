/**
 * The widget kit: escaping, formatting and every shared component, each returning an HTML
 * string. `createKit` is fully self-contained (it references nothing outside its own body) because
 * the shell ships it to the browser verbatim via `Function.prototype.toString` — the same code
 * renders a widget on the server (tests, gallery) and inside the MCP host's sandboxed iframe.
 *
 * Rules inside this file:
 * - No imports used from inside `createKit` and no module-level values (types are fine).
 * - No classes, async functions or generators (no transpiler helpers may be injected).
 * - Every text parameter is escaped here; parameters named `html`, `lead`, `aside`, `body`
 *   or `chart` take markup that must itself come from kit calls.
 *
 * Chart marks follow the FinApp chart spec: bars ≤ 24px with a 4px rounded data-end and a square
 * baseline, 2px lines, ≥ 8px markers with a 2px surface ring, 10% area washes, hairline solid
 * gridlines, 2px surface gaps, a legend for two or more series, hover tooltips (`data-tip`), a
 * visually hidden data table, and categorical colours in fixed order that fold into "Other".
 */

export type Minor = number | string | bigint | null | undefined;
export type Fmt = 'money' | 'number' | 'percent' | 'hours';
/** A series index (0–7, fixed categorical order) or a semantic tone. */
export type Tone =
  | number
  | 'income'
  | 'expense'
  | 'accent'
  | 'neutral'
  | 'warn'
  | 'muted'
  | 'info'
  | 'ink'
  | null
  | undefined;
export type Series = {
  name: string;
  values: ReadonlyArray<number | null>;
  tone?: Tone;
  dashed?: boolean;
};
export type ChartBase = {
  format?: Fmt;
  currency?: string;
  height?: number;
  title?: string;
};
export type BarItem = {
  label: string;
  value: number;
  sub?: string;
  valueText?: string;
  tone?: Tone;
  lead?: string;
};
export type RowInput = {
  lead?: string;
  title: string;
  sub?: string;
  value?: string;
  valueTone?: Tone;
  valueSub?: string;
  badge?: string;
  tip?: string;
  html?: string;
  muted?: boolean;
};
export type StatInput = {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
  delta?: number | null;
  goodWhen?: 'up' | 'down';
  spark?: ReadonlyArray<number>;
};
export type ButtonInput = {
  label: string;
  /** MCP tool to call through the host bridge. */
  call?: string;
  args?: Record<string, unknown>;
  /** Comma list of form fields merged into args: `name`, `name:minor`, `name:json`, `name?`. */
  fields?: string;
  /** Re-render with the tool result as this widget id (bundled via `views`). */
  view?: string;
  /** Render the result into the element with this id instead of replacing the widget. */
  into?: string;
  /** Flash text after success: a string, or a map keyed by `result.status` (`*` = default). */
  ok?: string | Record<string, string>;
  /** Follow-up chat message sent after success, or (without `call`) when clicked. */
  say?: string;
  currency?: string;
  primary?: boolean;
  mutation?: boolean;
};

export function createKit() {
  // ---------- Basics ----------
  const SERIES_COUNT = 8;
  function esc(value: unknown): string {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) =>
      c === '&'
        ? '&amp;'
        : c === '<'
          ? '&lt;'
          : c === '>'
            ? '&gt;'
            : c === '"'
              ? '&quot;'
              : '&#39;',
    );
  }
  function arr<T>(value: T[] | ReadonlyArray<T> | null | undefined): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }
  function num(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  function str(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }
  function sum(values: ReadonlyArray<unknown>): number {
    let total = 0;
    for (const value of values) total += num(value);
    return total;
  }
  function max(values: ReadonlyArray<number>, floor = 0): number {
    let best = floor;
    for (const value of values) if (Number.isFinite(value) && value > best) best = value;
    return best;
  }
  function avg(values: ReadonlyArray<number>): number {
    return values.length ? sum(values) / values.length : 0;
  }
  function clamp(value: number, lo = 0, hi = 1): number {
    return Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : 0));
  }
  function round(value: number): number {
    return Math.round(value * 100) / 100;
  }
  function join(parts: ReadonlyArray<unknown>): string {
    return parts
      .filter((part) => part !== null && part !== undefined && part !== false && part !== '')
      .join('');
  }
  function plural(count: number, one: string, many?: string): string {
    return count + ' ' + (count === 1 ? one : many || one + 's');
  }
  function initials(name: unknown): string {
    const words = String(name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const letters =
      words.length > 1
        ? words[0]![0]! + words[words.length - 1]![0]!
        : (words[0] || '?').slice(0, 1);
    return letters.toUpperCase();
  }
  function hash(text: unknown): number {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function safeColor(value: unknown): string | null {
    return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
  }

  // ---------- Money & numbers ----------
  const digitCache: Record<string, number> = {};
  function code(currency: unknown): string | null {
    return typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)
      ? currency.toUpperCase()
      : null;
  }
  function digits(currency: unknown): number {
    const c = code(currency);
    if (!c) return 2;
    if (digitCache[c] !== undefined) return digitCache[c]!;
    let d: number;
    try {
      d =
        new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions()
          .maximumFractionDigits ?? 2;
    } catch {
      d = 2;
    }
    digitCache[c] = d;
    return d;
  }
  /** Minor units → major units as a number (display only; exact text comes from *Formatted). */
  function major(minor: unknown, currency: unknown): number {
    return num(minor) / Math.pow(10, digits(currency));
  }
  function money(
    minor: unknown,
    currency?: unknown,
    opts?: { compact?: boolean; sign?: boolean; abs?: boolean },
  ): string {
    const o = opts || {};
    let value = major(minor, currency);
    if (o.abs) value = Math.abs(value);
    const c = code(currency);
    const big = Math.abs(value) >= 10000;
    let text: string;
    try {
      text = new Intl.NumberFormat('en', {
        style: c ? 'currency' : 'decimal',
        currency: c || undefined,
        notation: o.compact && big ? 'compact' : 'standard',
        minimumFractionDigits: o.compact ? 0 : c ? digits(c) : 0,
        maximumFractionDigits: o.compact ? (big ? 1 : 0) : c ? digits(c) : 2,
      }).format(Math.abs(value));
    } catch {
      text = Math.abs(value).toFixed(2);
    }
    const negative = value < 0;
    if (negative) return '−' + text;
    if (o.sign && value > 0) return '+' + text;
    return text;
  }
  /** `obj.<key>Formatted` when the server sent it, else formats `obj.<key>Minor`. */
  function amount(obj: unknown, key: string, currency?: unknown): string {
    if (!obj || typeof obj !== 'object') return '';
    const record = obj as Record<string, unknown>;
    const formatted = record[key + 'Formatted'];
    if (typeof formatted === 'string' && formatted) return formatted.replace(/^-/, '−');
    const minor = record[key + 'Minor'];
    if (minor === undefined || minor === null) return '';
    return money(minor, record.currency || currency);
  }
  function number(value: number, compact?: boolean): string {
    try {
      return new Intl.NumberFormat('en', {
        notation: compact && Math.abs(value) >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 2,
      }).format(value);
    } catch {
      return String(value);
    }
  }
  function percent(fraction: number, decimals = 0): string {
    return (Number.isFinite(fraction) ? (fraction * 100).toFixed(decimals) : '0') + '%';
  }
  function fmt(
    value: number,
    format: Fmt | undefined,
    currency: unknown,
    compact?: boolean,
  ): string {
    if (format === 'percent') return percent(value);
    if (format === 'number') return number(value, compact);
    if (format === 'hours') return number(value, compact) + 'h';
    return money(value, currency, { compact });
  }
  function toneOf(value: number): Tone {
    return value > 0 ? 'income' : value < 0 ? 'expense' : 'muted';
  }

  // ---------- Dates ----------
  function dateFormat(ms: unknown, options: Intl.DateTimeFormatOptions): string {
    const n = num(ms);
    if (!n) return '';
    try {
      return new Intl.DateTimeFormat('en', options).format(new Date(n));
    } catch {
      return '';
    }
  }
  function date(
    ms: unknown,
    style?: 'short' | 'long' | 'day' | 'month' | 'year' | 'weekday' | 'time' | 'datetime',
  ): string {
    if (style === 'long') return dateFormat(ms, { day: 'numeric', month: 'long', year: 'numeric' });
    if (style === 'day') return dateFormat(ms, { day: 'numeric', month: 'short' });
    if (style === 'month') return dateFormat(ms, { month: 'short', year: 'numeric' });
    if (style === 'year') return dateFormat(ms, { year: 'numeric' });
    if (style === 'weekday')
      return dateFormat(ms, { weekday: 'short', day: 'numeric', month: 'short' });
    if (style === 'time') return dateFormat(ms, { hour: 'numeric', minute: '2-digit' });
    if (style === 'datetime')
      return dateFormat(ms, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return dateFormat(ms, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function ago(ms: unknown, now?: number): string {
    const then = num(ms);
    if (!then) return '';
    const diff = (now || Date.now()) - then;
    const future = diff < 0;
    const s = Math.abs(diff) / 1000;
    const unit =
      s < 60
        ? 'just now'
        : s < 3600
          ? Math.round(s / 60) + 'm'
          : s < 86400
            ? Math.round(s / 3600) + 'h'
            : s < 86400 * 30
              ? Math.round(s / 86400) + 'd'
              : '';
    if (!unit) return date(then);
    if (unit === 'just now') return unit;
    return future ? 'in ' + unit : unit + ' ago';
  }
  function daysUntil(ms: unknown, now?: number): number {
    return Math.ceil((num(ms) - (now || Date.now())) / 86400000);
  }

  // ---------- Colour ----------
  function color(tone: Tone): string {
    if (typeof tone === 'number')
      return 'var(--s' + (Math.min(Math.max(0, Math.floor(tone)), SERIES_COUNT - 1) + 1) + ')';
    if (tone === 'income') return 'var(--income)';
    if (tone === 'expense') return 'var(--expense)';
    if (tone === 'warn') return 'var(--warn)';
    if (tone === 'neutral') return 'var(--other)';
    if (tone === 'muted') return 'var(--muted)';
    if (tone === 'info') return 'var(--s1)';
    if (tone === 'ink') return 'var(--text)';
    return 'var(--accent)';
  }
  function toneClass(tone: Tone): string {
    return tone === 'income'
      ? 'pos'
      : tone === 'expense'
        ? 'neg'
        : tone === 'warn'
          ? 'warn'
          : tone === 'muted'
            ? 'muted'
            : tone === 'accent'
              ? 'acc'
              : '';
  }
  /** Top `limit - 1` items by value plus one "Other" holding the rest (never cycle colours). */
  function fold<T extends { label: string; value: number }>(
    items: ReadonlyArray<T>,
    limit = SERIES_COUNT,
    otherLabel = 'Other',
  ): Array<T | { label: string; value: number; other: true }> {
    const sorted = items.slice().sort((a, b) => b.value - a.value);
    if (sorted.length <= limit) return sorted;
    const head = sorted.slice(0, limit - 1);
    const rest = sorted.slice(limit - 1);
    return [
      ...head,
      { label: otherLabel, value: sum(rest.map((item) => item.value)), other: true as const },
    ];
  }

  // ---------- Icons (inline SVG, currentColor) ----------
  const ICONS: Record<string, string> = {
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    right: 'M9 6l6 6-6 6',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6 6l12 12M18 6L6 18',
    alert: 'M12 4l9 16H3zM12 10v4M12 17.5v.5',
    info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5',
    bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
    lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 017 0v3',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    repeat: 'M4 12a7 7 0 0112-5l2 2M20 12a7 7 0 01-12 5l-2-2M18 4v5h-5M6 20v-5h5',
    wallet: 'M3 7h16v12H3zM3 7l12-3v3M15 13h2',
    card: 'M3 6h18v12H3zM3 10h18M7 15h4',
    bank: 'M3 10h18L12 4zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
    cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z',
    target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 11v2',
    users:
      'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a6 6 0 00-5-5.9',
    user: 'M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM4 21a8 8 0 0116 0',
    chat: 'M4 5h16v11H9l-5 4z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    spark: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    device: 'M7 3h10v18H7zM11 18h2',
    laptop: 'M5 5h14v10H5zM3 19h18',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
    tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
    pin: 'M9 3h6l-1 6 3 3H7l3-3zM12 12v9',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    send: 'M4 12l16-8-6 16-3-7z',
    restore: 'M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9M4 4v5h5',
    star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z',
    plus: 'M12 5v14M5 12h14',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
    flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-7 2 1 3 3 3 5',
    gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
    swap: 'M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
    split: 'M6 3v6l6 6M18 3v6l-6 6v6',
  };
  function icon(name: string, size = 16): string {
    const d = ICONS[name] || ICONS.info!;
    return (
      '<svg class="ico" width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      d +
      '"/></svg>'
    );
  }

  // ---------- Primitive blocks ----------
  function page(...parts: unknown[]): string {
    return '<div class="w">' + join(parts) + '</div>';
  }
  function header(eyebrow: string, title: string, aside?: string): string {
    return (
      '<header class="hd"><div class="hd-t">' +
      (eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : '') +
      '<h2>' +
      esc(title) +
      '</h2></div>' +
      (aside ? '<div class="hd-a">' + aside + '</div>' : '') +
      '</header>'
    );
  }
  function section(title: string, body: string, aside?: string): string {
    if (!body) return '';
    return (
      '<section class="sec"><div class="sec-h"><h3>' +
      esc(title) +
      '</h3>' +
      (aside ? '<span class="sec-a">' + aside + '</span>' : '') +
      '</div>' +
      body +
      '</section>'
    );
  }
  function card(body: string, opts?: { pad?: boolean; tone?: Tone; cls?: string }): string {
    const o = opts || {};
    return (
      '<div class="card' +
      (o.pad === false ? ' flush' : '') +
      (o.cls ? ' ' + o.cls : '') +
      '"' +
      (o.tone !== undefined && o.tone !== null ? ' style="--edge:' + color(o.tone) + '"' : '') +
      '>' +
      body +
      '</div>'
    );
  }
  function grid(items: ReadonlyArray<string>, min = 140): string {
    return '<div class="grid" style="--min:' + Math.round(min) + 'px">' + items.join('') + '</div>';
  }
  function cols(left: string, right: string): string {
    return '<div class="cols">' + left + right + '</div>';
  }
  function pill(text: string, tone?: Tone): string {
    return '<span class="pill ' + toneClass(tone) + '">' + esc(text) + '</span>';
  }
  function muted(text: string): string {
    return '<span class="muted">' + esc(text) + '</span>';
  }
  function text(value: unknown, tone?: Tone): string {
    const cls = toneClass(tone);
    return cls ? '<span class="' + cls + '">' + esc(value) + '</span>' : esc(value);
  }
  function note(value: string): string {
    return value ? '<p class="note">' + esc(value) + '</p>' : '';
  }
  function notice(value: string, tone?: Tone, iconName?: string): string {
    return (
      '<div class="notice ' +
      toneClass(tone) +
      '" role="status">' +
      icon(iconName || (tone === 'expense' ? 'alert' : tone === 'income' ? 'check' : 'info')) +
      '<span>' +
      esc(value) +
      '</span></div>'
    );
  }
  function empty(title: string, body?: string, iconName?: string): string {
    return (
      '<div class="empty" data-empty>' +
      '<div class="empty-i">' +
      icon(iconName || 'spark', 22) +
      '</div><strong>' +
      esc(title) +
      '</strong>' +
      (body ? '<p>' + esc(body) + '</p>' : '') +
      '</div>'
    );
  }
  function avatar(name: unknown, size = 34): string {
    return (
      '<span class="av av' +
      (hash(name) % 6) +
      '" style="--sz:' +
      size +
      'px" aria-hidden="true">' +
      esc(initials(name)) +
      '</span>'
    );
  }
  function avatars(names: ReadonlyArray<unknown>, limit = 4): string {
    const shown = names
      .slice(0, limit)
      .map((n) => avatar(n, 26))
      .join('');
    const extra =
      names.length > limit
        ? '<span class="av av-more" style="--sz:26px">+' + (names.length - limit) + '</span>'
        : '';
    return '<span class="stack">' + shown + extra + '</span>';
  }
  function tile(content: string, tone?: Tone, size = 34): string {
    return (
      '<span class="tile" style="--sz:' +
      size +
      'px;--c:' +
      color(tone === undefined ? 'accent' : tone) +
      '" aria-hidden="true">' +
      content +
      '</span>'
    );
  }
  /** Emoji or initial in a tinted tile (categories, merchants). */
  function glyph(label: unknown, emoji?: unknown, tone?: Tone): string {
    const e =
      typeof emoji === 'string' && emoji.trim() && emoji.length <= 8
        ? esc(emoji)
        : esc(initials(label).slice(0, 1));
    return tile(e, tone);
  }
  function delta(fraction: number | null | undefined, goodWhen: 'up' | 'down' = 'up'): string {
    if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '';
    const up = fraction > 0;
    const flat = Math.abs(fraction) < 0.005;
    const good = flat ? null : up === (goodWhen === 'up');
    return (
      '<span class="delta ' +
      (good === null ? 'muted' : good ? 'pos' : 'neg') +
      '">' +
      (flat ? '' : icon(up ? 'up' : 'down', 12)) +
      esc(flat ? 'flat' : percent(Math.abs(fraction))) +
      '</span>'
    );
  }
  function kv(pairs: ReadonlyArray<[string, string] | null | undefined | false>): string {
    const rows = pairs.filter(Boolean) as Array<[string, string]>;
    if (!rows.length) return '';
    return (
      '<dl class="kv">' +
      rows
        .map((pair) => '<div><dt>' + esc(pair[0]) + '</dt><dd>' + pair[1] + '</dd></div>')
        .join('') +
      '</dl>'
    );
  }
  function toggle(on: boolean, label: string, sub?: string): string {
    return (
      '<div class="row"><div class="grow"><div class="title">' +
      esc(label) +
      '</div>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
      '</div><span class="sw' +
      (on ? ' on' : '') +
      '" role="img" aria-label="' +
      esc(label + (on ? ': on' : ': off')) +
      '"><i></i></span></div>'
    );
  }
  function steps(items: ReadonlyArray<{ label: string; done: boolean; sub?: string }>): string {
    return (
      '<ol class="steps">' +
      items
        .map(
          (s) =>
            '<li class="' +
            (s.done ? 'done' : '') +
            '"><span class="dot">' +
            (s.done ? icon('check', 12) : '') +
            '</span><div><div class="title">' +
            esc(s.label) +
            '</div>' +
            (s.sub ? '<div class="sub">' + esc(s.sub) + '</div>' : '') +
            '</div></li>',
        )
        .join('') +
      '</ol>'
    );
  }

  // ---------- Rows, lists, tables ----------
  function row(r: RowInput): string {
    return (
      '<div class="row' +
      (r.muted ? ' dim' : '') +
      '"' +
      (r.tip ? ' data-tip="' + esc(r.tip) + '"' : '') +
      '>' +
      (r.lead || '') +
      '<div class="grow"><div class="title">' +
      esc(r.title) +
      (r.badge ? ' ' + r.badge : '') +
      '</div>' +
      (r.sub ? '<div class="sub">' + esc(r.sub) + '</div>' : '') +
      (r.html || '') +
      '</div>' +
      (r.value !== undefined && r.value !== ''
        ? '<div class="val"><span class="amount ' +
          toneClass(r.valueTone) +
          '">' +
          esc(r.value) +
          '</span>' +
          (r.valueSub ? '<span class="sub">' + esc(r.valueSub) + '</span>' : '') +
          '</div>'
        : '') +
      '</div>'
    );
  }
  function list(rows: ReadonlyArray<string>, emptyText?: string): string {
    if (!rows.length) return emptyText ? empty(emptyText) : '';
    return '<div class="card list">' + rows.join('') + '</div>';
  }
  function table(
    columns: ReadonlyArray<{ label: string; align?: 'left' | 'right' | 'center' }>,
    rows: ReadonlyArray<ReadonlyArray<string>>,
    caption?: string,
  ): string {
    if (!rows.length) return '';
    return (
      '<div class="card flush tbl-wrap"><table class="tbl">' +
      (caption ? '<caption class="sr-only">' + esc(caption) + '</caption>' : '') +
      '<thead><tr>' +
      columns
        .map((c) => '<th class="' + (c.align || 'left') + '" scope="col">' + esc(c.label) + '</th>')
        .join('') +
      '</tr></thead><tbody>' +
      rows
        .map(
          (r) =>
            '<tr>' +
            r
              .map(
                (cell, i) =>
                  '<td class="' +
                  ((columns[i] && columns[i]!.align) || 'left') +
                  '">' +
                  cell +
                  '</td>',
              )
              .join('') +
            '</tr>',
        )
        .join('') +
      '</tbody></table></div>'
    );
  }
  /** A visually hidden data table describing a chart for screen readers. */
  function srTable(
    caption: string,
    headers: ReadonlyArray<string>,
    rows: ReadonlyArray<ReadonlyArray<string>>,
  ): string {
    return (
      '<table class="sr-only"><caption>' +
      esc(caption) +
      '</caption><thead><tr>' +
      headers.map((h) => '<th scope="col">' + esc(h) + '</th>').join('') +
      '</tr></thead><tbody>' +
      rows
        .map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>')
        .join('') +
      '</tbody></table>'
    );
  }
  function timeline(
    items: ReadonlyArray<{
      title: string;
      sub?: string;
      time?: string;
      tone?: Tone;
      icon?: string;
      value?: string;
    }>,
  ): string {
    if (!items.length) return '';
    return (
      '<ol class="tl">' +
      items
        .map(
          (i) =>
            '<li><span class="tl-dot" style="--c:' +
            color(i.tone === undefined ? 'accent' : i.tone) +
            '">' +
            (i.icon ? icon(i.icon, 12) : '') +
            '</span><div class="grow"><div class="title">' +
            esc(i.title) +
            '</div>' +
            (i.sub ? '<div class="sub">' + esc(i.sub) + '</div>' : '') +
            '</div>' +
            (i.value
              ? '<span class="amount ' + toneClass(i.tone) + '">' + esc(i.value) + '</span>'
              : '') +
            (i.time ? '<time class="sub">' + esc(i.time) + '</time>' : '') +
            '</li>',
        )
        .join('') +
      '</ol>'
    );
  }
  function bubble(b: {
    text: string;
    from?: string;
    time?: string;
    mine?: boolean;
    meta?: string;
  }): string {
    return (
      '<div class="msg' +
      (b.mine ? ' mine' : '') +
      '">' +
      (b.mine ? '' : avatar(b.from || '?', 26)) +
      '<div class="bub">' +
      (b.from && !b.mine ? '<div class="sub">' + esc(b.from) + '</div>' : '') +
      '<div>' +
      esc(b.text) +
      '</div>' +
      (b.time || b.meta
        ? '<div class="sub">' +
          esc(join([b.meta, b.meta && b.time ? ' · ' : '', b.time])) +
          '</div>'
        : '') +
      '</div></div>'
    );
  }
  function receipt(r: {
    merchant: string;
    sub?: string;
    lines: ReadonlyArray<{ title: string; qty?: number; amount: string; sub?: string }>;
    totals: ReadonlyArray<{ label: string; amount: string; strong?: boolean }>;
    footer?: string;
  }): string {
    return (
      '<div class="rcpt"><div class="rcpt-h"><strong>' +
      esc(r.merchant) +
      '</strong>' +
      (r.sub ? '<span class="sub">' + esc(r.sub) + '</span>' : '') +
      '</div>' +
      '<div class="rcpt-l">' +
      r.lines
        .map(
          (l) =>
            '<div><span>' +
            esc(l.title) +
            (l.qty && l.qty > 1 ? ' <span class="muted">× ' + esc(l.qty) + '</span>' : '') +
            (l.sub ? '<span class="sub">' + esc(l.sub) + '</span>' : '') +
            '</span><span class="amount">' +
            esc(l.amount) +
            '</span></div>',
        )
        .join('') +
      '</div>' +
      '<div class="rcpt-t">' +
      r.totals
        .map(
          (t) =>
            '<div class="' +
            (t.strong ? 'strong' : '') +
            '"><span>' +
            esc(t.label) +
            '</span><span class="amount">' +
            esc(t.amount) +
            '</span></div>',
        )
        .join('') +
      '</div>' +
      (r.footer ? '<div class="rcpt-f sub">' + esc(r.footer) + '</div>' : '') +
      '</div>'
    );
  }
  function button(b: ButtonInput): string {
    const attrs: string[] = ['type="button"', 'class="btn' + (b.primary ? ' primary' : '') + '"'];
    if (b.call) attrs.push('data-call="' + esc(b.call) + '"');
    if (b.args) attrs.push('data-args="' + esc(JSON.stringify(b.args)) + '"');
    if (b.fields) attrs.push('data-fields="' + esc(b.fields) + '"');
    if (b.view) attrs.push('data-view="' + esc(b.view) + '"');
    if (b.into) attrs.push('data-into="' + esc(b.into) + '"');
    if (b.ok)
      attrs.push('data-ok="' + esc(typeof b.ok === 'string' ? b.ok : JSON.stringify(b.ok)) + '"');
    if (b.say) attrs.push((b.call ? 'data-say' : 'data-prompt') + '="' + esc(b.say) + '"');
    if (b.currency) attrs.push('data-currency="' + esc(b.currency) + '"');
    if (b.mutation) attrs.push('data-mutation');
    return '<button ' + attrs.join(' ') + '>' + esc(b.label) + '</button>';
  }
  function actions(...buttons: string[]): string {
    const items = buttons.filter(Boolean);
    return items.length
      ? '<div class="actions">' + items.join('') + '</div><div data-flash aria-live="polite"></div>'
      : '';
  }
  /** A follow-up prompt chip: clicking asks the assistant (no tool access needed). */
  function ask(label: string, prompt: string): string {
    return button({ label, say: prompt });
  }

  // ---------- Stats ----------
  function hero(h: {
    label: string;
    value: string;
    tone?: Tone;
    sub?: string;
    aside?: string;
    chart?: string;
  }): string {
    return (
      '<section class="hero"><div class="hero-t"><div><p class="eyebrow">' +
      esc(h.label) +
      '</p><div class="big ' +
      toneClass(h.tone) +
      '">' +
      esc(h.value) +
      '</div>' +
      (h.sub ? '<div class="sub">' + esc(h.sub) + '</div>' : '') +
      '</div>' +
      (h.aside || '') +
      '</div>' +
      (h.chart || '') +
      '</section>'
    );
  }
  function stat(s: StatInput): string {
    return (
      '<div class="stat"><span class="sub">' +
      esc(s.label) +
      '</span><strong class="' +
      toneClass(s.tone) +
      '">' +
      esc(s.value) +
      '</strong>' +
      (s.delta !== undefined || s.sub
        ? '<span class="stat-f">' +
          delta(s.delta, s.goodWhen) +
          (s.sub ? '<span class="sub">' + esc(s.sub) + '</span>' : '') +
          '</span>'
        : '') +
      (s.spark && s.spark.length > 1
        ? sparkline(s.spark, { tone: s.tone && s.tone !== 'muted' ? s.tone : 'accent', height: 28 })
        : '') +
      '</div>'
    );
  }
  function stats(items: ReadonlyArray<StatInput | null | undefined | false>, min = 120): string {
    const shown = items.filter(Boolean) as StatInput[];
    return shown.length
      ? '<div class="stats" style="--min:' + min + 'px">' + shown.map(stat).join('') + '</div>'
      : '';
  }

  // ---------- Bars, meters, rings ----------
  function meter(m: {
    label: string;
    value: number;
    max: number;
    sub?: string;
    valueText?: string;
    maxText?: string;
    lead?: string;
    tone?: Tone;
    warnAt?: number;
    tip?: string;
  }): string {
    const ratio = m.max > 0 ? m.value / m.max : m.value > 0 ? 1 : 0;
    const warnAt = m.warnAt === undefined ? 0.85 : m.warnAt;
    const state = ratio > 1 ? 'over' : ratio >= warnAt ? 'near' : 'ok';
    const fill =
      m.tone !== undefined && m.tone !== null
        ? color(m.tone)
        : state === 'over'
          ? 'var(--expense)'
          : state === 'near'
            ? 'var(--warn)'
            : 'var(--accent)';
    const pct = Math.round(clamp(ratio) * 100);
    return (
      '<div class="meter ' +
      state +
      '"' +
      ' data-tip="' +
      esc(
        m.tip ||
          m.label +
            ': ' +
            (m.valueText || number(m.value)) +
            (m.maxText ? ' of ' + m.maxText : '') +
            ' (' +
            percent(ratio) +
            ')',
      ) +
      '">' +
      '<div class="meter-h">' +
      (m.lead || '') +
      '<span class="title grow">' +
      esc(m.label) +
      '</span><span class="sub">' +
      esc(join([m.valueText, m.maxText ? ' of ' + m.maxText : ''])) +
      '</span></div>' +
      '<div class="track" role="progressbar" aria-label="' +
      esc(m.label) +
      '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      Math.round(ratio * 100) +
      '"><i style="width:' +
      pct +
      '%;background:' +
      fill +
      '"></i>' +
      (ratio > 1 ? '<b style="left:' + Math.round((1 / ratio) * 100) + '%"></b>' : '') +
      '</div>' +
      (m.sub
        ? '<div class="sub ' + (state === 'over' ? 'neg' : '') + '">' + esc(m.sub) + '</div>'
        : '') +
      '</div>'
    );
  }
  function progress(fraction: number, tone?: Tone): string {
    return (
      '<div class="track thin"><i style="width:' +
      Math.round(clamp(fraction) * 100) +
      '%;background:' +
      color(tone === undefined ? 'accent' : tone) +
      '"></i></div>'
    );
  }
  function ring(r: {
    value: number;
    size?: number;
    label?: string;
    center?: string;
    tone?: Tone;
    sub?: string;
    thickness?: number;
  }): string {
    const size = r.size || 96;
    const t = r.thickness || Math.max(6, Math.round(size / 10));
    const radius = (size - t) / 2;
    const c = 2 * Math.PI * radius;
    const v = clamp(r.value);
    const stroke = color(r.tone === undefined ? (r.value >= 1 ? 'income' : 'accent') : r.tone);
    return (
      '<figure class="ring" style="--sz:' +
      size +
      'px"><svg width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 ' +
      size +
      ' ' +
      size +
      '" role="img" aria-label="' +
      esc((r.label || 'Progress') + ' ' + percent(r.value)) +
      '">' +
      '<circle cx="' +
      size / 2 +
      '" cy="' +
      size / 2 +
      '" r="' +
      round(radius) +
      '" style="fill:none;stroke:var(--track);stroke-width:' +
      t +
      '"/>' +
      (v > 0
        ? '<circle cx="' +
          size / 2 +
          '" cy="' +
          size / 2 +
          '" r="' +
          round(radius) +
          '" style="fill:none;stroke:' +
          stroke +
          ';stroke-width:' +
          t +
          ';stroke-linecap:round;stroke-dasharray:' +
          round(c * v) +
          ' ' +
          round(c) +
          '" transform="rotate(-90 ' +
          size / 2 +
          ' ' +
          size / 2 +
          ')"/>'
        : '') +
      '</svg><div class="ring-c"><strong>' +
      esc(r.center === undefined ? percent(r.value) : r.center) +
      '</strong>' +
      (r.sub ? '<span class="sub">' + esc(r.sub) + '</span>' : '') +
      '</div>' +
      (r.label ? '<figcaption class="sub">' + esc(r.label) + '</figcaption>' : '') +
      '</figure>'
    );
  }
  function legend(
    items: ReadonlyArray<{ label: string; tone: Tone; dashed?: boolean; value?: string }>,
  ): string {
    return (
      '<div class="legend">' +
      items
        .map(
          (i) =>
            '<span><i class="' +
            (i.dashed ? 'dash' : '') +
            '" style="--c:' +
            color(i.tone) +
            '"></i>' +
            esc(i.label) +
            (i.value ? ' <b>' + esc(i.value) + '</b>' : '') +
            '</span>',
        )
        .join('') +
      '</div>'
    );
  }
  /** Ranked horizontal bars (HTML): label, value and a bar scaled to the largest item. */
  function barList(o: {
    items: ReadonlyArray<BarItem>;
    format?: Fmt;
    currency?: string;
    limit?: number;
    tone?: Tone;
    title?: string;
    showShare?: boolean;
  }): string {
    const all = o.items.slice().sort((a, b) => b.value - a.value);
    const limit = o.limit || 8;
    let items: BarItem[] = all;
    if (all.length > limit) {
      const rest = all.slice(limit - 1);
      items = all.slice(0, limit - 1).concat([
        {
          label: 'Other (' + rest.length + ')',
          value: sum(rest.map((r) => r.value)),
          tone: 'neutral',
        },
      ]);
    }
    if (!items.length) return '';
    const top = max(
      items.map((i) => Math.abs(i.value)),
      1,
    );
    const total = sum(all.map((i) => i.value)) || 1;
    return (
      '<div class="bars">' +
      items
        .map((i) => {
          const v = i.valueText || fmt(i.value, o.format, o.currency);
          const share = o.showShare ? ' · ' + percent(i.value / total) : '';
          return (
            '<div class="brow" data-tip="' +
            esc(i.label + ': ' + v + share) +
            '">' +
            (i.lead || '') +
            '<div class="grow"><div class="brow-h"><span class="title">' +
            esc(i.label) +
            '</span><span class="amount">' +
            esc(v) +
            '</span></div>' +
            '<div class="hbar"><i style="width:' +
            Math.max(1, Math.round((Math.abs(i.value) / top) * 100)) +
            '%;background:' +
            color(i.tone !== undefined ? i.tone : o.tone !== undefined ? o.tone : 0) +
            '"></i></div>' +
            (i.sub || o.showShare
              ? '<div class="sub">' +
                esc(
                  join([i.sub, o.showShare ? (i.sub ? ' · ' : '') + percent(i.value / total) : '']),
                ) +
                '</div>'
              : '') +
            '</div></div>'
          );
        })
        .join('') +
      '</div>' +
      srTable(
        o.title || 'Ranking',
        ['Item', 'Value'],
        items.map((i) => [i.label, i.valueText || fmt(i.value, o.format, o.currency)]),
      )
    );
  }
  /** A single 100% bar split into parts (2px surface gaps) with a legend. */
  function segments(o: {
    items: ReadonlyArray<{ label: string; value: number; tone?: Tone }>;
    format?: Fmt;
    currency?: string;
    title?: string;
    legend?: boolean;
  }): string {
    const items = o.items.filter((i) => i.value > 0);
    const total = sum(items.map((i) => i.value));
    if (!total) return '';
    return (
      '<div class="seg" role="img" aria-label="' +
      esc(o.title || 'Breakdown') +
      '">' +
      items
        .map(
          (i, idx) =>
            '<i style="flex:' +
            round(i.value / total) +
            ';background:' +
            color(i.tone !== undefined ? i.tone : idx) +
            '" data-tip="' +
            esc(
              i.label +
                ': ' +
                fmt(i.value, o.format, o.currency) +
                ' · ' +
                percent(i.value / total),
            ) +
            '"></i>',
        )
        .join('') +
      '</div>' +
      (o.legend === false
        ? ''
        : legend(
            items.map((i, idx) => ({
              label: i.label,
              tone: i.tone !== undefined ? i.tone : idx,
              value: percent(i.value / total),
            })),
          )) +
      srTable(
        o.title || 'Breakdown',
        ['Part', 'Value', 'Share'],
        items.map((i) => [i.label, fmt(i.value, o.format, o.currency), percent(i.value / total)]),
      )
    );
  }

  // ---------- SVG chart math ----------
  function niceTicks(lo: number, hi: number, count = 4): number[] {
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo === hi) {
      if (lo === 0) return [0, 1];
      const pad = Math.abs(lo) * 0.5;
      return niceTicks(Math.min(0, lo - pad), Math.max(0, hi + pad), count);
    }
    const raw = (hi - lo) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const steps = [1, 2, 2.5, 5, 10].map((m) => m * mag);
    let step = 10 * mag;
    for (const candidate of steps)
      if (candidate >= raw) {
        step = candidate;
        break;
      }
    const start = Math.floor(lo / step) * step;
    const end = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
    return ticks;
  }
  function scale(d0: number, d1: number, r0: number, r1: number) {
    const span = d1 - d0 || 1;
    return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
  }
  function tangents(pts: ReadonlyArray<[number, number]>): number[] {
    const n = pts.length;
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++)
      slopes.push((pts[i + 1]![1] - pts[i]![1]) / (pts[i + 1]![0] - pts[i]![0] || 1));
    const t = [slopes[0]!];
    for (let i = 1; i < n - 1; i++) {
      const a = slopes[i - 1]!;
      const b = slopes[i]!;
      t.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
    }
    t.push(slopes[n - 2]!);
    return t;
  }
  function linePath(pts: ReadonlyArray<[number, number]>, smooth = true): string {
    if (!pts.length) return '';
    if (pts.length < 3 || !smooth)
      return pts.map((p, i) => (i ? 'L' : 'M') + round(p[0]) + ' ' + round(p[1])).join('');
    const t = tangents(pts);
    let d = 'M' + round(pts[0]![0]) + ' ' + round(pts[0]![1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const dx = (p1[0] - p0[0]) / 3;
      d +=
        'C' +
        round(p0[0] + dx) +
        ' ' +
        round(p0[1] + t[i]! * dx) +
        ' ' +
        round(p1[0] - dx) +
        ' ' +
        round(p1[1] - t[i + 1]! * dx) +
        ' ' +
        round(p1[0]) +
        ' ' +
        round(p1[1]);
    }
    return d;
  }
  function areaPath(pts: ReadonlyArray<[number, number]>, base: number, smooth = true): string {
    if (!pts.length) return '';
    return (
      linePath(pts, smooth) +
      'L' +
      round(pts[pts.length - 1]![0]) +
      ' ' +
      round(base) +
      'L' +
      round(pts[0]![0]) +
      ' ' +
      round(base) +
      'Z'
    );
  }
  /** Vertical bar with a rounded data-end and square baseline (downward bars round the bottom). */
  function barPath(
    x: number,
    w: number,
    baseY: number,
    valueY: number,
    radius = 4,
    roundEnd = true,
  ): string {
    const top = Math.min(baseY, valueY);
    const h = Math.abs(baseY - valueY);
    if (h < 0.5) return '';
    const r = roundEnd ? Math.min(radius, w / 2, h) : 0;
    const l = round(x);
    const rt = round(x + w);
    if (valueY <= baseY) {
      const b = round(top + h);
      return (
        'M' +
        l +
        ' ' +
        b +
        'V' +
        round(top + r) +
        'Q' +
        l +
        ' ' +
        round(top) +
        ' ' +
        round(x + r) +
        ' ' +
        round(top) +
        'H' +
        round(x + w - r) +
        'Q' +
        rt +
        ' ' +
        round(top) +
        ' ' +
        rt +
        ' ' +
        round(top + r) +
        'V' +
        b +
        'Z'
      );
    }
    const bottom = top + h;
    return (
      'M' +
      l +
      ' ' +
      round(top) +
      'V' +
      round(bottom - r) +
      'Q' +
      l +
      ' ' +
      round(bottom) +
      ' ' +
      round(x + r) +
      ' ' +
      round(bottom) +
      'H' +
      round(x + w - r) +
      'Q' +
      rt +
      ' ' +
      round(bottom) +
      ' ' +
      rt +
      ' ' +
      round(bottom - r) +
      'V' +
      round(top) +
      'Z'
    );
  }
  function arcPath(
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    a0: number,
    a1: number,
  ): string {
    const sweep = a1 - a0;
    if (sweep <= 0) return '';
    if (sweep >= Math.PI * 2 - 1e-6) {
      const mid = a0 + Math.PI;
      return (
        arcPath(cx, cy, outer, inner, a0, mid) +
        arcPath(cx, cy, outer, inner, mid, a0 + Math.PI * 2 - 1e-6)
      );
    }
    const large = sweep > Math.PI ? 1 : 0;
    const pt = (r: number, a: number) =>
      round(cx + r * Math.sin(a)) + ' ' + round(cy - r * Math.cos(a));
    return (
      'M' +
      pt(outer, a0) +
      'A' +
      outer +
      ' ' +
      outer +
      ' 0 ' +
      large +
      ' 1 ' +
      pt(outer, a1) +
      'L' +
      pt(inner, a1) +
      'A' +
      inner +
      ' ' +
      inner +
      ' 0 ' +
      large +
      ' 0 ' +
      pt(inner, a0) +
      'Z'
    );
  }
  function stride(count: number, maxLabels: number): number {
    return Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
  }
  function axisWidth(
    ticks: ReadonlyArray<number>,
    format: Fmt | undefined,
    currency: unknown,
  ): number {
    return Math.min(
      72,
      10 +
        max(
          ticks.map((t) => fmt(t, format, currency, true).length),
          1,
        ) *
          6.4,
    );
  }

  const W = 600;
  function svgOpen(h: number, label: string): string {
    return (
      '<svg class="chart" viewBox="0 0 ' +
      W +
      ' ' +
      h +
      '" width="100%" role="img" aria-label="' +
      esc(label) +
      '" preserveAspectRatio="xMidYMid meet">'
    );
  }
  function yAxis(
    ticks: ReadonlyArray<number>,
    y: (v: number) => number,
    left: number,
    right: number,
    format: Fmt | undefined,
    currency: unknown,
  ): string {
    return ticks
      .map(
        (t) =>
          '<line class="grid' +
          (t === 0 ? ' zero' : '') +
          '" x1="' +
          left +
          '" x2="' +
          right +
          '" y1="' +
          round(y(t)) +
          '" y2="' +
          round(y(t)) +
          '"/><text class="ax" x="' +
          (left - 6) +
          '" y="' +
          round(y(t) + 3.5) +
          '" text-anchor="end">' +
          esc(fmt(t, format, currency, true)) +
          '</text>',
      )
      .join('');
  }
  function xLabels(
    labels: ReadonlyArray<string>,
    x: (i: number) => number,
    y: number,
    maxLabels = 7,
  ): string {
    const s = stride(labels.length, maxLabels);
    return labels
      .map((l, i) =>
        i === labels.length - 1 || (i % s === 0 && labels.length - 1 - i >= Math.ceil(s / 2))
          ? '<text class="ax" x="' +
            round(x(i)) +
            '" y="' +
            y +
            '" text-anchor="middle">' +
            esc(l) +
            '</text>'
          : '',
      )
      .join('');
  }

  /** Line / area chart with a crosshair tooltip per x position. Values are minor units for money. */
  function lineChart(
    o: ChartBase & {
      labels: ReadonlyArray<string>;
      series: ReadonlyArray<Series>;
      area?: boolean;
      zero?: boolean;
      ref?: { value: number; label: string };
      smooth?: boolean;
      markers?: boolean;
    },
  ): string {
    const labels = o.labels;
    const series = o.series.filter((s) => s.values.some((v) => v !== null && Number.isFinite(v)));
    if (!labels.length || !series.length) return '';
    const h = o.height || 190;
    const values: number[] = [];
    series.forEach((s) =>
      s.values.forEach((v) => v !== null && Number.isFinite(v) && values.push(v)),
    );
    if (o.ref) values.push(o.ref.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (o.zero !== false || o.area) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    }
    const ticks = niceTicks(lo, hi === lo ? lo + 1 : hi, 4);
    const top = 10;
    const bottom = h - 24;
    const left = axisWidth(ticks, o.format, o.currency);
    const right = W - 10;
    const y = scale(ticks[0]!, ticks[ticks.length - 1]!, bottom, top);
    const n = labels.length;
    const x = (i: number) =>
      n === 1 ? (left + right) / 2 : left + 6 + (i * (right - left - 12)) / (n - 1);
    let body = yAxis(ticks, y, left, right, o.format, o.currency);
    if (o.ref)
      body +=
        '<line class="ref" x1="' +
        left +
        '" x2="' +
        right +
        '" y1="' +
        round(y(o.ref.value)) +
        '" y2="' +
        round(y(o.ref.value)) +
        '"/><text class="ax ref-t" x="' +
        (right - 2) +
        '" y="' +
        round(y(o.ref.value) - 5) +
        '" text-anchor="end">' +
        esc(o.ref.label) +
        '</text>';
    series.forEach((s, si) => {
      const tone = s.tone !== undefined ? s.tone : si;
      const c = color(tone);
      // Split into runs at nulls (gaps are honest, never interpolated).
      let run: Array<[number, number]> = [];
      const runs: Array<Array<[number, number]>> = [];
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) {
          if (run.length) runs.push(run);
          run = [];
        } else run.push([x(i), y(v)]);
      });
      if (run.length) runs.push(run);
      runs.forEach((r) => {
        if ((o.area || series.length === 1) && !s.dashed && o.area !== false)
          body +=
            '<path d="' +
            areaPath(
              r,
              y(Math.max(ticks[0]!, Math.min(0, ticks[ticks.length - 1]!))),
              o.smooth !== false,
            ) +
            '" style="fill:' +
            c +
            ';fill-opacity:.1;stroke:none"/>';
        body +=
          '<path d="' +
          linePath(r, o.smooth !== false) +
          '" style="fill:none;stroke:' +
          c +
          ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round' +
          (s.dashed ? ';stroke-dasharray:5 4' : '') +
          '"/>';
        if (r.length === 1)
          body +=
            '<circle cx="' +
            round(r[0]![0]) +
            '" cy="' +
            round(r[0]![1]) +
            '" r="4" style="fill:' +
            c +
            ';stroke:var(--surface);stroke-width:2"/>';
      });
      const lastIndex = (() => {
        for (let i = s.values.length - 1; i >= 0; i--)
          if (s.values[i] !== null && Number.isFinite(s.values[i] as number)) return i;
        return -1;
      })();
      if (lastIndex >= 0 && !s.dashed)
        body +=
          '<circle cx="' +
          round(x(lastIndex)) +
          '" cy="' +
          round(y(s.values[lastIndex] as number)) +
          '" r="4" style="fill:' +
          c +
          ';stroke:var(--surface);stroke-width:2"/>';
      if (o.markers)
        s.values.forEach((v, i) => {
          if (v !== null && Number.isFinite(v) && i !== lastIndex)
            body +=
              '<circle cx="' +
              round(x(i)) +
              '" cy="' +
              round(y(v)) +
              '" r="4" style="fill:' +
              c +
              ';stroke:var(--surface);stroke-width:2"/>';
        });
    });
    body += xLabels(labels, x, h - 6);
    // Hover bands
    const band = n > 1 ? (right - left - 12) / (n - 1) : right - left;
    labels.forEach((l, i) => {
      const tip =
        l +
        series
          .map((s) =>
            s.values[i] === null || s.values[i] === undefined
              ? ''
              : '\n' + s.name + ': ' + fmt(s.values[i] as number, o.format, o.currency),
          )
          .join('');
      body +=
        '<rect class="hit" x="' +
        round(x(i) - band / 2) +
        '" y="' +
        top +
        '" width="' +
        round(band) +
        '" height="' +
        (bottom - top) +
        '" data-tip="' +
        esc(tip) +
        '"/>';
    });
    const title = o.title || 'Chart';
    return (
      '<figure class="fig">' +
      svgOpen(h, title) +
      body +
      '</svg>' +
      (series.length > 1 || o.ref
        ? legend(
            series.map((s, i) => ({
              label: s.name,
              tone: s.tone !== undefined ? s.tone : i,
              dashed: s.dashed,
            })),
          )
        : '') +
      srTable(
        title,
        ['Label'].concat(series.map((s) => s.name)),
        labels.map((l, i) =>
          [l].concat(
            series.map((s) =>
              s.values[i] === null || s.values[i] === undefined
                ? '—'
                : fmt(s.values[i] as number, o.format, o.currency),
            ),
          ),
        ),
      ) +
      '</figure>'
    );
  }

  /** Columns: grouped, stacked, or diverging (series[0] up, series[1] down) with an optional net line. */
  function columns(
    o: ChartBase & {
      labels: ReadonlyArray<string>;
      series: ReadonlyArray<Series>;
      mode?: 'grouped' | 'stacked' | 'diverging';
      net?: ReadonlyArray<number> | boolean;
      netName?: string;
      highlight?: number;
      ref?: { value: number; label: string };
    },
  ): string {
    const labels = o.labels;
    const series = o.series;
    const mode = o.mode || 'grouped';
    if (!labels.length || !series.length) return '';
    const h = o.height || 190;
    const n = labels.length;
    const v = (s: Series, i: number) => {
      const raw = s.values[i];
      return raw === null || raw === undefined || !Number.isFinite(raw) ? 0 : raw;
    };
    let net: number[] | null = null;
    if (mode === 'diverging' && o.net !== false && series.length >= 2)
      net = Array.isArray(o.net)
        ? (o.net as number[]).slice()
        : labels.map((_, i) => v(series[0]!, i) - Math.abs(v(series[1]!, i)));
    else if (Array.isArray(o.net)) net = (o.net as number[]).slice();
    const all: number[] = [0];
    labels.forEach((_, i) => {
      if (mode === 'stacked') {
        all.push(sum(series.map((s) => Math.max(0, v(s, i)))));
        all.push(sum(series.map((s) => Math.min(0, v(s, i)))));
      } else if (mode === 'diverging') {
        all.push(Math.abs(v(series[0]!, i)));
        if (series[1]) all.push(-Math.abs(v(series[1], i)));
      } else series.forEach((s) => all.push(v(s, i)));
    });
    if (net) net.forEach((x) => all.push(x));
    if (o.ref) all.push(o.ref.value);
    const ticks = niceTicks(
      Math.min(...all),
      Math.max(...all) === Math.min(...all) ? Math.min(...all) + 1 : Math.max(...all),
      4,
    );
    const top = 10;
    const bottom = h - 24;
    const left = axisWidth(ticks, o.format, o.currency);
    const right = W - 8;
    const y = scale(ticks[0]!, ticks[ticks.length - 1]!, bottom, top);
    const step = (right - left) / n;
    const groupW = Math.min(
      step * 0.72,
      mode === 'grouped' ? 24 * series.length + 2 * (series.length - 1) : 24,
    );
    const cx = (i: number) => left + step * i + step / 2;
    let body = yAxis(ticks, y, left, right, o.format, o.currency);
    const zero = y(0);
    labels.forEach((_label, i) => {
      const dim = o.highlight !== undefined && o.highlight !== i ? ';opacity:.45' : '';
      if (mode === 'grouped') {
        const bw = Math.max(2, Math.min(24, (groupW - 2 * (series.length - 1)) / series.length));
        const start = cx(i) - (bw * series.length + 2 * (series.length - 1)) / 2;
        series.forEach((s, si) => {
          const val = v(s, i);
          body +=
            '<path d="' +
            barPath(start + si * (bw + 2), bw, zero, y(val)) +
            '" style="fill:' +
            color(s.tone !== undefined ? s.tone : si) +
            dim +
            '"/>';
        });
      } else if (mode === 'stacked') {
        const bw = Math.max(2, Math.min(24, groupW));
        let pos = 0;
        let neg = 0;
        const lastPos = (() => {
          for (let si = series.length - 1; si >= 0; si--) if (v(series[si]!, i) > 0) return si;
          return -1;
        })();
        series.forEach((s, si) => {
          const val = v(s, i);
          if (!val) return;
          const from = val > 0 ? pos : neg;
          const to = from + val;
          if (val > 0) pos = to;
          else neg = to;
          body +=
            '<path d="' +
            barPath(cx(i) - bw / 2, bw, y(from), y(to), 4, si === lastPos || val < 0) +
            '" style="fill:' +
            color(s.tone !== undefined ? s.tone : si) +
            ';stroke:var(--surface);stroke-width:1' +
            dim +
            '"/>';
        });
      } else {
        const bw = Math.max(2, Math.min(24, groupW));
        const up = Math.abs(v(series[0]!, i));
        const down = series[1] ? Math.abs(v(series[1], i)) : 0;
        body +=
          '<path d="' +
          barPath(cx(i) - bw / 2, bw, zero - 1, y(up)) +
          '" style="fill:' +
          color(series[0]!.tone !== undefined ? series[0]!.tone : 'income') +
          dim +
          '"/>';
        if (series[1])
          body +=
            '<path d="' +
            barPath(cx(i) - bw / 2, bw, zero + 1, y(-down)) +
            '" style="fill:' +
            color(series[1].tone !== undefined ? series[1].tone : 'expense') +
            dim +
            '"/>';
      }
    });
    if (o.ref)
      body +=
        '<line class="ref" x1="' +
        left +
        '" x2="' +
        right +
        '" y1="' +
        round(y(o.ref.value)) +
        '" y2="' +
        round(y(o.ref.value)) +
        '"/><text class="ax ref-t" x="' +
        (right - 2) +
        '" y="' +
        round(y(o.ref.value) - 5) +
        '" text-anchor="end">' +
        esc(o.ref.label) +
        '</text>';
    if (net) {
      const pts = net.map((val, i) => [cx(i), y(val)] as [number, number]);
      body +=
        '<path d="' +
        linePath(pts, false) +
        '" style="fill:none;stroke:var(--text);stroke-width:2;stroke-linejoin:round"/>';
      pts.forEach(
        (p) =>
          (body +=
            '<circle cx="' +
            round(p[0]) +
            '" cy="' +
            round(p[1]) +
            '" r="4" style="fill:var(--text);stroke:var(--surface);stroke-width:2"/>'),
      );
    }
    body += xLabels(labels, cx, h - 6, 8);
    labels.forEach((label, i) => {
      const tip =
        label +
        series
          .map(
            (s) =>
              '\n' +
              s.name +
              ': ' +
              fmt(mode === 'diverging' ? Math.abs(v(s, i)) : v(s, i), o.format, o.currency),
          )
          .join('') +
        (net ? '\n' + (o.netName || 'Net') + ': ' + fmt(net[i]!, o.format, o.currency) : '');
      body +=
        '<rect class="hit" x="' +
        round(left + step * i) +
        '" y="' +
        top +
        '" width="' +
        round(step) +
        '" height="' +
        (bottom - top) +
        '" data-tip="' +
        esc(tip) +
        '"/>';
    });
    const legendItems: Array<{ label: string; tone: Tone; dashed?: boolean }> = series.map(
      (s, i) => ({
        label: s.name,
        tone:
          s.tone !== undefined
            ? s.tone
            : mode === 'diverging'
              ? i === 0
                ? 'income'
                : 'expense'
              : i,
      }),
    );
    if (net) legendItems.push({ label: o.netName || 'Net', tone: 'ink' });
    const title = o.title || 'Chart';
    return (
      '<figure class="fig">' +
      svgOpen(h, title) +
      body +
      '</svg>' +
      (legendItems.length > 1 ? legend(legendItems) : '') +
      srTable(
        title,
        ['Label'].concat(
          series.map((s) => s.name),
          net ? [o.netName || 'Net'] : [],
        ),
        labels.map((l, i) =>
          [l].concat(
            series.map((s) =>
              fmt(mode === 'diverging' ? Math.abs(v(s, i)) : v(s, i), o.format, o.currency),
            ),
            net ? [fmt(net[i]!, o.format, o.currency)] : [],
          ),
        ),
      ) +
      '</figure>'
    );
  }

  /** Donut with the total in the centre and a legend table; folds past 8 categories into Other. */
  function donut(o: {
    items: ReadonlyArray<{ label: string; value: number; tone?: Tone }>;
    format?: Fmt;
    currency?: string;
    centerLabel?: string;
    centerValue?: string;
    title?: string;
    size?: number;
  }): string {
    const positive = o.items.filter((i) => i.value > 0);
    const folded = fold(
      positive.map((i) => ({ label: i.label, value: i.value, tone: i.tone })),
      SERIES_COUNT,
    );
    const total = sum(folded.map((i) => i.value));
    if (!total) return '';
    const size = o.size || 168;
    const outer = size / 2;
    const inner = outer * 0.64;
    let angle = 0;
    const gap = folded.length > 1 ? 0.025 : 0;
    const usable = Math.PI * 2 - gap * (folded.length > 1 ? folded.length : 0);
    const toneFor = (item: { tone?: Tone; other?: boolean }, i: number): Tone =>
      'other' in item && item.other ? 'neutral' : item.tone !== undefined ? item.tone : i;
    const paths = folded
      .map((item, i) => {
        const sweep = (item.value / total) * usable;
        const d = arcPath(outer, outer, outer, inner, angle, angle + sweep);
        angle += sweep + gap;
        return (
          '<path d="' +
          d +
          '" style="fill:' +
          color(toneFor(item as { tone?: Tone; other?: boolean }, i)) +
          '" data-tip="' +
          esc(
            item.label +
              ': ' +
              fmt(item.value, o.format, o.currency) +
              ' · ' +
              percent(item.value / total),
          ) +
          '"/>'
        );
      })
      .join('');
    const title = o.title || 'Breakdown';
    return (
      '<figure class="donut"><div class="donut-c" style="--sz:' +
      size +
      'px"><svg width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 ' +
      size +
      ' ' +
      size +
      '" role="img" aria-label="' +
      esc(title) +
      '">' +
      paths +
      '</svg>' +
      '<div class="donut-t"><span class="sub">' +
      esc(o.centerLabel || 'Total') +
      '</span><strong>' +
      esc(o.centerValue || fmt(total, o.format, o.currency, true)) +
      '</strong></div></div>' +
      '<table class="lg-t"><caption class="sr-only">' +
      esc(title) +
      '</caption><tbody>' +
      folded
        .map(
          (item, i) =>
            '<tr data-tip="' +
            esc(item.label + ': ' + fmt(item.value, o.format, o.currency)) +
            '"><td><i style="--c:' +
            color(toneFor(item as { tone?: Tone; other?: boolean }, i)) +
            '"></i>' +
            esc(item.label) +
            '</td><td class="amount">' +
            esc(fmt(item.value, o.format, o.currency)) +
            '</td><td class="sub right">' +
            esc(percent(item.value / total)) +
            '</td></tr>',
        )
        .join('') +
      '</tbody></table></figure>'
    );
  }

  /** Small inline trend line (no axes). */
  function sparkline(
    values: ReadonlyArray<number>,
    opts?: { tone?: Tone; height?: number; width?: number; area?: boolean; bars?: boolean },
  ): string {
    const o = opts || {};
    const vals = values.filter((v) => Number.isFinite(v));
    if (vals.length < 2) return '';
    const w = o.width || 120;
    const h = o.height || 32;
    const lo = Math.min(...vals, o.bars ? 0 : Infinity);
    const hi = Math.max(...vals);
    const y = scale(lo, hi === lo ? lo + 1 : hi, h - 3, 3);
    const c = color(o.tone === undefined ? 'accent' : o.tone);
    if (o.bars) {
      // HTML bars keep their 24px cap at any width (an SVG stretched to fit would widen them).
      const top = Math.max(...vals, 1);
      return (
        '<div class="sparkb" style="--h:' +
        h +
        'px" aria-hidden="true">' +
        vals
          .map(
            (v) =>
              '<i style="height:' +
              Math.max(4, Math.round((v / top) * 100)) +
              '%;background:' +
              c +
              '"></i>',
          )
          .join('') +
        '</div>'
      );
    }
    const pts = vals.map(
      (v, i) => [3 + (i * (w - 6)) / (vals.length - 1), y(v)] as [number, number],
    );
    const last = pts[pts.length - 1]!;
    return (
      '<svg class="spark" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '" width="100%" height="' +
      h +
      '" preserveAspectRatio="none" aria-hidden="true">' +
      (o.area === false
        ? ''
        : '<path d="' + areaPath(pts, h, true) + '" style="fill:' + c + ';fill-opacity:.1"/>') +
      '<path d="' +
      linePath(pts, true) +
      '" style="fill:none;stroke:' +
      c +
      ';stroke-width:2;vector-effect:non-scaling-stroke"/>' +
      '<circle cx="' +
      round(last[0]) +
      '" cy="' +
      round(last[1]) +
      '" r="3" style="fill:' +
      c +
      ';stroke:var(--surface);stroke-width:1.5"/></svg>'
    );
  }

  /** Matrix heatmap (e.g. weekday × hour). Cells use one sequential hue with value-scaled opacity. */
  function heatmap(o: {
    rows: ReadonlyArray<string>;
    cols: ReadonlyArray<string>;
    values: ReadonlyArray<ReadonlyArray<number>>;
    format?: Fmt;
    currency?: string;
    title?: string;
    colStride?: number;
    tone?: Tone;
    maxCell?: number;
  }): string {
    const rows = o.rows;
    const colsList = o.cols;
    if (!rows.length || !colsList.length) return '';
    const flat: number[] = [];
    o.values.forEach((r) => r.forEach((v) => flat.push(v)));
    const top = max(flat, 0);
    const left = Math.min(
      70,
      8 +
        max(
          rows.map((r) => r.length),
          1,
        ) *
          6.4,
    );
    const cell = Math.min(o.maxCell || 28, (W - left - 4) / colsList.length);
    const gap = 2;
    const h = rows.length * cell + 18;
    const width = left + cell * colsList.length + 4;
    const c = color(o.tone === undefined ? 0 : o.tone);
    let body = '';
    rows.forEach((r, ri) => {
      body +=
        '<text class="ax" x="' +
        (left - 6) +
        '" y="' +
        round(ri * cell + cell / 2 + 3.5) +
        '" text-anchor="end">' +
        esc(r) +
        '</text>';
      colsList.forEach((col, ci) => {
        const v = (o.values[ri] && o.values[ri]![ci]) || 0;
        const t = top > 0 ? v / top : 0;
        body +=
          '<rect x="' +
          round(left + ci * cell) +
          '" y="' +
          round(ri * cell) +
          '" width="' +
          round(cell - gap) +
          '" height="' +
          round(cell - gap) +
          '" rx="2" style="fill:' +
          (v > 0 ? c + ';fill-opacity:' + round(0.14 + t * 0.86) : 'var(--track)') +
          '" data-tip="' +
          esc(r + ' · ' + col + ': ' + fmt(v, o.format, o.currency)) +
          '"/>';
      });
    });
    const s = o.colStride || stride(colsList.length, 12);
    colsList.forEach((col, ci) => {
      if (ci % s === 0)
        body +=
          '<text class="ax" x="' +
          round(left + ci * cell + (cell - gap) / 2) +
          '" y="' +
          (h - 4) +
          '" text-anchor="middle">' +
          esc(col) +
          '</text>';
    });
    const title = o.title || 'Heatmap';
    return (
      '<figure class="fig"><svg class="chart" viewBox="0 0 ' +
      round(width) +
      ' ' +
      h +
      '" width="100%" style="max-width:' +
      round(width * 1.25) +
      'px" role="img" aria-label="' +
      esc(title) +
      '">' +
      body +
      '</svg>' +
      '<div class="legend scale"><span class="sub">Less</span>' +
      [0.14, 0.35, 0.57, 0.78, 1]
        .map((a) => '<i style="--c:' + c + ';opacity:' + a + '"></i>')
        .join('') +
      '<span class="sub">More</span></div>' +
      srTable(
        title,
        [''].concat(colsList as string[]),
        rows.map((r, ri) =>
          [r].concat(
            colsList.map((_, ci) =>
              fmt((o.values[ri] && o.values[ri]![ci]) || 0, o.format, o.currency),
            ),
          ),
        ),
      ) +
      '</figure>'
    );
  }

  /** Month calendar: cells shaded by value, with event chips (bills, paydays). */
  function calendar(o: {
    year: number;
    month: number;
    values?: Record<string, number>;
    marks?: Record<string, ReadonlyArray<{ label: string; tone?: Tone }>>;
    format?: Fmt;
    currency?: string;
    today?: number;
    title?: string;
  }): string {
    const first = new Date(Date.UTC(o.year, o.month, 1));
    const daysIn = new Date(Date.UTC(o.year, o.month + 1, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const values = o.values || {};
    const marks = o.marks || {};
    const top = max(
      Object.keys(values).map((k) => values[k]!),
      0,
    );
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<div class="cal-d pad"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const v = values[String(d)] || 0;
      const m = marks[String(d)] || [];
      const t = top > 0 ? v / top : 0;
      const tip = [
        String(d) +
          ' ' +
          dateFormat(Date.UTC(o.year, o.month, d), { month: 'short', timeZone: 'UTC' }),
      ]
        .concat(
          v ? [fmt(v, o.format, o.currency)] : [],
          m.map((x) => x.label),
        )
        .join('\n');
      cells +=
        '<div class="cal-d' +
        (o.today === d ? ' today' : '') +
        '"' +
        (v || m.length ? ' data-tip="' + esc(tip) + '"' : '') +
        ' style="' +
        (v ? '--a:' + round(0.12 + t * 0.7) : '') +
        '">' +
        '<span class="cal-n">' +
        d +
        '</span>' +
        (m.length
          ? '<span class="cal-m">' +
            m
              .slice(0, 3)
              .map(
                (x) =>
                  '<i style="--c:' + color(x.tone === undefined ? 'accent' : x.tone) + '"></i>',
              )
              .join('') +
            '</span>'
          : '') +
        '</div>';
    }
    const title =
      o.title || dateFormat(first.getTime(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const rows: string[][] = [];
    for (let d = 1; d <= daysIn; d++)
      if (values[String(d)] || (marks[String(d)] || []).length)
        rows.push([
          String(d),
          values[String(d)] ? fmt(values[String(d)]!, o.format, o.currency) : '',
          (marks[String(d)] || []).map((x) => x.label).join(', '),
        ]);
    return (
      '<figure class="cal"><div class="cal-g">' +
      ['M', 'T', 'W', 'T', 'F', 'S', 'S']
        .map((d) => '<div class="cal-w">' + d + '</div>')
        .join('') +
      cells +
      '</div>' +
      srTable(title, ['Day', 'Value', 'Events'], rows) +
      '</figure>'
    );
  }

  // ---------- Finance composites ----------
  type Tx = {
    id?: string;
    title?: string;
    type?: string;
    amountMinor?: unknown;
    amountFormatted?: string;
    currency?: string;
    merchant?: string;
    occurredAt?: number;
    categoryName?: string;
    categoryIcon?: string;
    accountName?: string;
    status?: string;
    items?: ReadonlyArray<{
      title?: string;
      quantity?: number;
      amountMinor?: unknown;
      amountFormatted?: string;
      participantIds?: ReadonlyArray<string>;
    }>;
  };
  function txSign(type: unknown): { prefix: string; tone: Tone } {
    if (type === 'income' || type === 'refund') return { prefix: '+', tone: 'income' };
    if (type === 'expense') return { prefix: '−', tone: 'expense' };
    if (type === 'transfer') return { prefix: '', tone: 'muted' };
    return { prefix: '', tone: null };
  }
  function txAmount(tx: Tx): string {
    const raw = amount(tx, 'amount').replace(/^[−-]/, '');
    return txSign(tx.type).prefix + raw;
  }
  function lineItems(
    items: Tx['items'],
    currency?: string,
    names?: Record<string, string>,
  ): string {
    const list = arr(items);
    if (!list.length) return '';
    return (
      '<div class="items">' +
      list
        .map((item) => {
          const who = arr(item.participantIds)
            .map((id) => (names && names[id]) || '')
            .filter(Boolean);
          return (
            '<div><span>' +
            esc(str(item.title, 'Item')) +
            (item.quantity && item.quantity > 1
              ? ' <span class="muted">× ' + esc(item.quantity) + '</span>'
              : '') +
            (who.length ? ' <span class="muted">· ' + esc(who.join(', ')) + '</span>' : '') +
            '</span><span class="amount">' +
            esc(amount(item, 'amount', currency)) +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function txRow(tx: Tx, opts?: { showAccount?: boolean }): string {
    const sign = txSign(tx.type);
    const sub = [
      tx.merchant && tx.merchant !== tx.title ? tx.merchant : '',
      tx.categoryName,
      opts && opts.showAccount ? tx.accountName : '',
      date(tx.occurredAt, 'day'),
      tx.status && tx.status !== 'posted' ? tx.status : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const items = arr(tx.items);
    const r = row({
      lead: glyph(tx.title, tx.categoryIcon, sign.tone === 'income' ? 'income' : 'accent'),
      title: str(tx.title, 'Transaction'),
      sub: sub + (items.length ? (sub ? ' · ' : '') + plural(items.length, 'item') : ''),
      value: txAmount(tx),
      valueTone: sign.tone,
    });
    if (!items.length) return r;
    return (
      '<details class="tx"><summary>' +
      r +
      '</summary>' +
      lineItems(items, tx.currency) +
      '</details>'
    );
  }
  function txList(
    items: ReadonlyArray<Tx>,
    emptyTitle = 'No transactions',
    emptyBody?: string,
  ): string {
    if (!items.length) return empty(emptyTitle, emptyBody, 'receipt');
    return '<div class="card list">' + items.map((tx) => txRow(tx)).join('') + '</div>';
  }
  function person(p: {
    name: string;
    sub?: string;
    value?: string;
    valueTone?: Tone;
    badge?: string;
    html?: string;
  }): string {
    return row({
      lead: avatar(p.name),
      title: p.name,
      sub: p.sub,
      value: p.value,
      valueTone: p.valueTone,
      badge: p.badge,
      html: p.html,
    });
  }
  const ACCOUNT_ICONS: Record<string, string> = {
    bank: 'bank',
    card: 'card',
    cash: 'cash',
    wallet: 'wallet',
    loan: 'swap',
    other: 'wallet',
  };
  function accountIcon(type: unknown, tone?: Tone): string {
    return tile(
      icon(ACCOUNT_ICONS[String(type)] || 'wallet', 18),
      tone === undefined ? 'accent' : tone,
    );
  }

  return {
    // basics
    esc,
    arr,
    num,
    str,
    sum,
    max,
    avg,
    clamp,
    round,
    join,
    plural,
    initials,
    hash,
    safeColor,
    fold,
    // formatting
    money,
    amount,
    major,
    digits,
    number,
    percent,
    fmt,
    toneOf,
    date,
    ago,
    daysUntil,
    // colour & icons
    color,
    toneClass,
    icon,
    // blocks
    page,
    header,
    section,
    card,
    grid,
    cols,
    pill,
    muted,
    text,
    note,
    notice,
    empty,
    avatar,
    avatars,
    tile,
    glyph,
    delta,
    kv,
    toggle,
    steps,
    row,
    list,
    table,
    srTable,
    timeline,
    bubble,
    receipt,
    button,
    actions,
    ask,
    hero,
    stat,
    stats,
    meter,
    progress,
    ring,
    legend,
    barList,
    segments,
    // charts
    lineChart,
    columns,
    donut,
    sparkline,
    heatmap,
    calendar,
    // finance
    txRow,
    txList,
    txAmount,
    txSign,
    lineItems,
    person,
    accountIcon,
    // math (exposed for tests)
    niceTicks,
    linePath,
    areaPath,
    barPath,
    arcPath,
  };
}

export type Kit = ReturnType<typeof createKit>;
