/**
 * Self-contained widget runtime shared by every FinApp in-chat widget. It is plain ES5-style
 * JavaScript (no backticks or template interpolation so it can live in a TS string), builds the
 * DOM with textContent only (user data never reaches innerHTML), and talks to the host through:
 *
 * - the MCP Apps bridge (JSON-RPC over postMessage: ui/initialize, ui/notifications/tool-result,
 *   ui/notifications/host-context-changed, tools/call, ui/message, size-changed), and
 * - the ChatGPT Apps SDK globals as a fallback (window.openai.toolOutput / theme / callTool and
 *   the openai:set_globals event).
 */
export const widgetCss = `
:root {
  color-scheme: light;
  --fa-bg: #ffffff;
  --fa-panel: #f4f4ef;
  --fa-line: rgba(0, 0, 0, 0.12);
  --fa-text: #0b0b0b;
  --fa-muted: #5f5f5a;
  --fa-accent: #365d00;
  --fa-accent-ink: #ffffff;
  --fa-accent-soft: rgba(54, 93, 0, 0.1);
  --fa-income: #187f43;
  --fa-expense: #c93f43;
  --fa-warn: #876700;
  --fa-radius: 16px;
  --fa-font: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --fa-bg: #090909;
  --fa-panel: #151515;
  --fa-line: rgba(255, 255, 255, 0.12);
  --fa-text: #f4f4f0;
  --fa-muted: #a3a39d;
  --fa-accent: #b7ff4a;
  --fa-accent-ink: #0b0b0b;
  --fa-accent-soft: rgba(183, 255, 74, 0.12);
  --fa-income: #4ed37a;
  --fa-expense: #ff6868;
  --fa-warn: #f5c84b;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--fa-bg); color: var(--fa-text); font-family: var(--fa-font); font-size: 14px; line-height: 1.4; }
button, input, select { font: inherit; color: inherit; }
#app { padding: 16px; display: grid; gap: 14px; }
.eyebrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fa-muted); margin: 0; }
h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
h1 { font-size: 26px; } h2 { font-size: 16px; } h3 { font-size: 14px; }
.muted { color: var(--fa-muted); }
.hero { background: var(--fa-accent-soft); border: 1px solid var(--fa-line); border-radius: var(--fa-radius); padding: 16px; display: grid; gap: 6px; }
.hero .big { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.stat { background: var(--fa-panel); border: 1px solid var(--fa-line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 2px; }
.stat strong { font-size: 16px; font-variant-numeric: tabular-nums; }
.card { background: var(--fa-panel); border: 1px solid var(--fa-line); border-radius: var(--fa-radius); padding: 4px 12px; }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--fa-line); }
.row:last-child { border-bottom: 0; }
.grow { flex: 1; min-width: 0; }
.row .title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .sub { font-size: 12px; color: var(--fa-muted); }
.amount { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.pos { color: var(--fa-income); } .neg { color: var(--fa-expense); }
.tile { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--fa-accent-soft); color: var(--fa-accent); font-weight: 600; flex: none; }
.bar { height: 6px; border-radius: 999px; background: var(--fa-line); overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--fa-accent); border-radius: inherit; }
.bar.over > i { background: var(--fa-expense); }
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--fa-line); color: var(--fa-muted); }
.pill.accent { background: var(--fa-accent); color: var(--fa-accent-ink); border-color: transparent; }
.pill.warn { color: var(--fa-warn); }
.btn { border: 1px solid var(--fa-line); background: transparent; border-radius: 999px; padding: 6px 12px; cursor: pointer; font-weight: 500; }
.btn:hover { border-color: var(--fa-accent); }
.btn.primary { background: var(--fa-accent); color: var(--fa-accent-ink); border-color: transparent; }
.btn:disabled { opacity: 0.55; cursor: progress; }
.btn:focus-visible, .toggle:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--fa-accent); outline-offset: 2px; }
.toggle { background: none; border: 0; padding: 0; cursor: pointer; color: var(--fa-accent); font-size: 12px; }
.items { margin: 0 0 10px 44px; padding: 8px 10px; border-left: 2px solid var(--fa-accent); display: grid; gap: 4px; font-size: 13px; }
.items div { display: flex; justify-content: space-between; gap: 8px; }
.spark { display: flex; align-items: flex-end; gap: 4px; height: 42px; }
.spark i { flex: 1; background: var(--fa-accent); border-radius: 4px 4px 1px 1px; min-height: 2px; opacity: 0.85; }
.field { display: grid; gap: 4px; font-size: 12px; color: var(--fa-muted); }
.field input, .field select { background: var(--fa-bg); border: 1px solid var(--fa-line); border-radius: 10px; padding: 8px 10px; font-size: 14px; }
.choice { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--fa-line); cursor: pointer; }
.choice:last-child { border-bottom: 0; }
.choice input { accent-color: var(--fa-accent); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.notice { font-size: 13px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--fa-line); }
.notice.error { color: var(--fa-expense); }
.notice.ok { color: var(--fa-income); }
.empty { text-align: center; padding: 22px 8px; color: var(--fa-muted); }
.skeleton { height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--fa-panel), var(--fa-line), var(--fa-panel)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

export const widgetRuntime = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app');
  var kind = document.body.getAttribute('data-widget');
  var state = { data: null, view: kind, pending: null };

  // ---------- DOM helpers (textContent only) ----------
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = String(value);
        else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2), value);
        else el.setAttribute(key, value === true ? '' : String(value));
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { add(el, c); }); return; }
    el.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  function mount() {
    root.textContent = '';
    for (var i = 0; i < arguments.length; i++) add(root, arguments[i]);
    reportSize();
  }
  function initial(name) { return (String(name || '?').trim()[0] || '?').toUpperCase(); }
  function date(ms) {
    try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return ''; }
  }
  function money(obj, key) {
    if (!obj) return '';
    var formatted = obj[key + 'Formatted'];
    if (formatted) return formatted;
    var minor = obj[key + 'Minor'];
    return minor === undefined ? '' : String(minor) + ' ' + (obj.currency || '');
  }
  function sign(minor) { var s = String(minor || '0'); return s.charAt(0) === '-' ? -1 : s.replace(/0/g, '') === '' ? 0 : 1; }
  function absFormatted(text) { return String(text || '').replace(/^-/, '').replace(/^\((.*)\)$/, '$1'); }
  function digits(currency) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).resolvedOptions().maximumFractionDigits; }
    catch (e) { return 2; }
  }
  function toMinor(text, currency) {
    var d = digits(currency);
    var clean = String(text).replace(/[,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    var parts = clean.split('.');
    var frac = (parts[1] || '');
    if (frac.length > d) return null;
    while (frac.length < d) frac += '0';
    var joined = (parts[0] + frac).replace(/^0+(?=\d)/, '');
    return joined === '0' || joined === '' ? null : joined;
  }
  function fromMinor(minor, currency) {
    var d = digits(currency);
    var s = String(minor).replace('-', '');
    while (s.length <= d) s = '0' + s;
    return d ? s.slice(0, s.length - d) + '.' + s.slice(s.length - d) : s;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return ((Math.random() * 16) | 0).toString(16); });
  }

  // ---------- Host bridge ----------
  var nextId = 1, waiting = {}, bridgeReady = false;
  function post(message) { try { window.parent.postMessage(message, '*'); } catch (e) { /* detached */ } }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      waiting[id] = { resolve: resolve, reject: reject };
      post({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
      setTimeout(function () {
        if (waiting[id]) { delete waiting[id]; reject(new Error('The host did not respond.')); }
      }, 30000);
    });
  }
  function notify(method, params) { post({ jsonrpc: '2.0', method: method, params: params || {} }); }
  function applyTheme(theme) { if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme); }
  function applyContext(context) { if (context && context.theme) applyTheme(context.theme); }
  function receive(result) {
    if (!result) return;
    var content = result.structuredContent;
    if (content && typeof content === 'object' && 'data' in content) content = content.data;
    if (content === undefined) return;
    if (result.isError) { state.error = textOf(result) || 'The request failed.'; }
    else { state.error = null; state.data = content; state.view = kind; }
    render();
  }
  function textOf(result) {
    var blocks = (result && result.content) || [];
    for (var i = 0; i < blocks.length; i++) if (blocks[i] && blocks[i].type === 'text') return blocks[i].text;
    return '';
  }
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    if (message.id !== undefined && message.id !== null && !message.method) {
      var entry = waiting[message.id];
      if (!entry) return;
      delete waiting[message.id];
      if (message.error) entry.reject(new Error(message.error.message || 'Request failed.'));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === 'ui/notifications/tool-result') receive(message.params);
    else if (message.method === 'ui/notifications/host-context-changed') applyContext(message.params);
    if (message.method && message.id !== undefined && message.id !== null) post({ jsonrpc: '2.0', id: message.id, result: {} });
  });

  function callTool(name, args) {
    var call = bridgeReady
      ? request('tools/call', { name: name, arguments: args })
      : window.openai && window.openai.callTool
        ? Promise.resolve(window.openai.callTool(name, args))
        : Promise.reject(new Error('This client cannot run actions from the widget. Ask in chat instead.'));
    return call.then(function (result) {
      if (result && result.isError) throw new Error(textOf(result) || 'The action failed.');
      var content = result && result.structuredContent;
      return content && typeof content === 'object' && 'data' in content ? content.data : content;
    });
  }
  function sendMessage(text) {
    if (bridgeReady) return request('ui/message', { role: 'user', content: { type: 'text', text: text } });
    if (window.openai && window.openai.sendFollowUpMessage) return Promise.resolve(window.openai.sendFollowUpMessage({ prompt: text }));
    return Promise.reject(new Error('Unavailable'));
  }
  var lastHeight = 0;
  function reportSize() {
    var height = Math.ceil(document.documentElement.scrollHeight);
    if (height === lastHeight) return;
    lastHeight = height;
    if (bridgeReady) notify('ui/notifications/size-changed', { width: Math.ceil(document.documentElement.scrollWidth), height: height });
  }
  if (window.ResizeObserver) new ResizeObserver(reportSize).observe(document.documentElement);

  // ---------- Shared pieces ----------
  function header(eyebrow, title, extra) {
    return h('header', { class: 'actions', style: 'justify-content:space-between' },
      h('div', null, h('p', { class: 'eyebrow', text: eyebrow }), h('h2', { text: title })), extra || null);
  }
  function notice(text, tone) { return h('div', { class: 'notice ' + (tone || ''), role: tone === 'error' ? 'alert' : 'status', text: text }); }
  function loading() {
    return h('div', { class: 'card', 'aria-busy': 'true' },
      [0, 1, 2].map(function () { return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'skeleton', style: 'width:60%' }))); }));
  }
  function actionButton(label, run, primary) {
    var button = h('button', { class: primary ? 'btn primary' : 'btn', type: 'button', text: label });
    button.addEventListener('click', function () {
      button.disabled = true;
      Promise.resolve().then(run).catch(function (error) { flash(error.message || String(error), 'error'); }).then(function () { button.disabled = false; });
    });
    return button;
  }
  var flashTarget = null;
  function flash(text, tone) {
    if (!flashTarget) return;
    flashTarget.textContent = '';
    flashTarget.appendChild(notice(text, tone));
    reportSize();
  }
  function flashArea() { flashTarget = h('div', { 'aria-live': 'polite' }); return flashTarget; }

  // ---------- Renderers ----------
  function itemList(items, currency, names) {
    return h('div', { class: 'items' }, items.map(function (item) {
      var who = (item.participantIds || []).map(function (id) { return names && names[id] ? names[id] : null; }).filter(Boolean);
      return h('div', null,
        h('span', null, item.title + (item.quantity && item.quantity > 1 ? ' × ' + item.quantity : ''),
          who.length ? h('span', { class: 'muted', text: ' · ' + who.join(', ') }) : null),
        h('span', { class: 'amount', text: item.amountFormatted || money(Object.assign({ currency: currency }, item), 'amount') }));
    }));
  }
  function transactionRow(tx) {
    var outflow = tx.type === 'expense' || tx.type === 'transfer';
    var wrap = h('div');
    var expanded = false;
    var detail = null;
    var hasItems = tx.items && tx.items.length;
    var toggle = hasItems ? h('button', { class: 'toggle', type: 'button', 'aria-expanded': 'false', text: tx.items.length + ' items' }) : null;
    var row = h('div', { class: 'row' },
      h('span', { class: 'tile', text: initial(tx.title) }),
      h('div', { class: 'grow' }, h('div', { class: 'title', text: tx.title }),
        h('div', { class: 'sub' }, [tx.merchant, date(tx.occurredAt), tx.type].filter(Boolean).join(' · '), toggle ? ' · ' : null, toggle)),
      h('span', { class: 'amount ' + (tx.type === 'income' || tx.type === 'refund' ? 'pos' : outflow ? 'neg' : ''), text: (tx.type === 'income' || tx.type === 'refund' ? '+' : outflow ? '−' : '') + absFormatted(money(tx, 'amount')) }));
    wrap.appendChild(row);
    if (toggle) toggle.addEventListener('click', function () {
      expanded = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      if (expanded) { detail = itemList(tx.items, tx.currency); wrap.appendChild(detail); }
      else if (detail) { wrap.removeChild(detail); detail = null; }
      reportSize();
    });
    return wrap;
  }

  function renderTransactions(data) {
    var items = (data && data.items) || [];
    mount(
      header('Transactions', items.length + (items.length === 1 ? ' result' : ' results'),
        data && data.isDone === false ? h('span', { class: 'pill', text: 'More available' }) : null),
      items.length ? h('div', { class: 'card' }, items.map(transactionRow)) : h('div', { class: 'empty', text: 'No transactions match these filters.' }),
      data && data.isDone === false ? h('p', { class: 'muted', style: 'margin:0;font-size:12px', text: 'Ask for the next page to continue.' }) : null);
  }

  function renderOverview(data) {
    var trend = data.spendingTrend || [];
    var max = Math.max.apply(null, trend.concat([1]));
    var net = sign(data.netMinor);
    mount(
      header('Overview', date(data.period && data.period.startAt) + ' – ' + date(data.period && data.period.endAt)),
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow', text: 'Net this period' }),
        h('div', { class: 'big ' + (net < 0 ? 'neg' : net > 0 ? 'pos' : ''), text: money(data, 'net') }),
        trend.length ? h('div', { class: 'spark', 'aria-hidden': 'true' }, trend.map(function (v) { return h('i', { style: 'height:' + Math.max(4, Math.round((v / max) * 100)) + '%' }); })) : null),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'muted', text: 'Income' }), h('strong', { class: 'pos', text: money(data, 'income') })),
        h('div', { class: 'stat' }, h('span', { class: 'muted', text: 'Spent' }), h('strong', { class: 'neg', text: money(data, 'spent') })),
        (data.totals || []).map(function (t) { return h('div', { class: 'stat' }, h('span', { class: 'muted', text: 'Balance ' + t.currency }), h('strong', { text: money(t, 'balance') })); })),
      (data.accounts || []).length ? h('section', null, h('h3', { text: 'Accounts', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, data.accounts.map(function (a) {
        return h('div', { class: 'row' }, h('span', { class: 'tile', text: initial(a.name) }),
          h('div', { class: 'grow' }, h('div', { class: 'title', text: a.name }), h('div', { class: 'sub', text: a.type + (a.isIncludedInTotal ? '' : ' · excluded from total') })),
          h('span', { class: 'amount ' + (sign(a.balanceMinor) < 0 ? 'neg' : ''), text: money(a, 'balance') }));
      }))) : null,
      (data.categoryLimits || []).length ? h('section', null, h('h3', { text: 'Category limits', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, data.categoryLimits.map(function (b) {
        var pct = Math.min(100, Math.round((b.progress || 0) * 100));
        return h('div', { class: 'row', style: 'display:grid;gap:6px' },
          h('div', { class: 'actions', style: 'justify-content:space-between' }, h('span', { class: 'title', text: b.name }), h('span', { class: 'sub', text: money(b, 'spent') + ' of ' + money(b, 'limit') })),
          h('div', { class: 'bar' + ((b.progress || 0) > 1 ? ' over' : ''), role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': b.name }, h('i', { style: 'width:' + pct + '%' })));
      }))) : null,
      (data.recent || []).length ? h('section', null, h('h3', { text: 'Recent', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, data.recent.map(transactionRow))) : null);
  }

  function renderBalances(data) {
    if (data.status !== 'ready') { mount(header('Balances', data.group ? data.group.name : 'Group'), notice('Balances are still being prepared for this group. Try again shortly.')); return; }
    var mine = sign(data.myBalanceMinor);
    var maxAbs = 1;
    (data.members || []).forEach(function (m) { var n = Math.abs(Number(m.amountMinor)); if (n > maxAbs) maxAbs = n; });
    mount(
      header('Group balances', data.group.name, h('span', { class: 'pill', text: data.currency })),
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow', text: mine === 0 ? 'All square' : mine > 0 ? 'You are owed' : 'You owe' }),
        h('div', { class: 'big ' + (mine > 0 ? 'pos' : mine < 0 ? 'neg' : ''), text: mine === 0 ? 'Settled up' : absFormatted(money(data, 'myBalance')) })),
      h('section', null, h('h3', { text: 'Members', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, (data.members || []).map(function (m) {
        var s = sign(m.amountMinor);
        return h('div', { class: 'row' }, h('span', { class: 'tile', text: initial(m.displayName) }),
          h('div', { class: 'grow' }, h('div', { class: 'title', text: m.displayName + (m.isMe ? ' (you)' : '') }),
            h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: 'width:' + Math.round(Math.abs(Number(m.amountMinor)) / maxAbs * 100) + '%;background:var(' + (s < 0 ? '--fa-expense' : '--fa-income') + ')' }))),
          h('span', { class: 'amount ' + (s > 0 ? 'pos' : s < 0 ? 'neg' : 'muted'), text: s === 0 ? 'settled' : (s > 0 ? 'gets ' : 'owes ') + absFormatted(money(m, 'amount')) }));
      }))),
      transferSection(data, false),
      flashArea());
  }

  function transferSection(data, selectable) {
    var transfers = data.transfers || [];
    if (!transfers.length) return h('div', { class: 'empty', text: 'Nobody owes anything. Nice.' });
    return h('section', null, h('h3', { text: 'Suggested transfers', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, transfers.map(function (t, index) {
      var label = t.fromName + ' → ' + t.toName;
      var actions = [];
      if (!selectable && t.direction === 'you_pay') actions.push(actionButton('Settle up', function () {
        return callTool('finapp.groups.settle_up.prepare', { groupId: data.group.id }).then(function (next) { state.data = next; state.view = 'settleUp'; render(); });
      }, true));
      if (t.direction === 'you_receive') actions.push(actionButton('Remind', function () {
        return callTool('finapp.groups.nudge', { groupId: data.group.id, userId: t.fromUserId }).then(function (r) {
          flash(r && r.status === 'alreadySent' ? 'Already reminded ' + t.fromName + ' today.' : r && r.status === 'muted' ? t.fromName + ' has turned off payment reminders.' : 'Reminder sent to ' + t.fromName + '.', 'ok');
        });
      }));
      var body = [h('div', { class: 'grow' }, h('div', { class: 'title', text: label }), h('div', { class: 'sub', text: t.direction === 'you_pay' ? 'You pay' : t.direction === 'you_receive' ? 'You receive' : 'Between others' })),
        h('span', { class: 'amount', text: money(Object.assign({ currency: data.currency }, t), 'amount') })].concat(actions);
      if (!selectable) return h('div', { class: 'row' }, body);
      var radio = h('input', { type: 'radio', name: 'transfer', value: String(index), checked: index === 0 });
      radio.addEventListener('change', function () { state.pending = index; syncAmount(); });
      return h('label', { class: 'choice' }, radio, body);
    })));
  }

  var amountInput = null;
  function syncAmount() {
    var data = state.data;
    var t = data && data.transfers && data.transfers[state.pending || 0];
    if (t && amountInput) amountInput.value = fromMinor(t.amountMinor, data.currency);
  }
  function renderSettleUp(data) {
    state.pending = 0;
    var transfers = data.transfers || [];
    if (!transfers.length) { mount(header('Settle up', data.group.name), h('div', { class: 'empty', text: 'You have nothing to settle in this group.' })); return; }
    var accounts = data.accounts || [];
    var accountSelect = h('select', { id: 'fa-account' }, accounts.map(function (a) { return h('option', { value: a.id, text: a.name + ' · ' + money(a, 'balance') }); }));
    amountInput = h('input', { id: 'fa-amount', inputmode: 'decimal', autocomplete: 'off' });
    var noteInput = h('input', { id: 'fa-note', maxlength: '500', placeholder: 'e.g. UPI reference' });
    var done = false;
    mount(
      header('Settle up', data.group.name, h('span', { class: 'pill', text: data.currency })),
      transferSection(data, true),
      accounts.length ? null : notice('Add an account in ' + data.currency + ' to record a settlement.', 'error'),
      h('div', { class: 'stats' },
        h('label', { class: 'field', for: 'fa-amount' }, 'Amount (' + data.currency + ')', amountInput),
        h('label', { class: 'field', for: 'fa-account' }, 'Your account', accountSelect)),
      h('label', { class: 'field', for: 'fa-note' }, 'Note (optional)', noteInput),
      h('div', { class: 'actions' }, actionButton('Record settlement', function () {
        if (done) return;
        var t = transfers[state.pending || 0];
        var minor = toMinor(amountInput.value, data.currency);
        if (!minor) throw new Error('Enter a positive amount with at most ' + digits(data.currency) + ' decimals.');
        if (!accountSelect.value) throw new Error('Choose one of your accounts.');
        var args = { groupId: data.group.id, fromUserId: t.fromUserId, toUserId: t.toUserId, accountId: accountSelect.value, amountMinor: minor, currency: data.currency, clientMutationId: uuid() };
        if (noteInput.value.trim()) args.note = noteInput.value.trim();
        return callTool('finapp.groups.settlements.create', args).then(function () {
          done = true;
          flash('Settlement of ' + amountInput.value + ' ' + data.currency + ' recorded (' + t.fromName + ' → ' + t.toName + ').', 'ok');
          sendMessage('I recorded a settlement of ' + amountInput.value + ' ' + data.currency + ' from ' + t.fromName + ' to ' + t.toName + ' in ' + data.group.name + '.').catch(function () {});
        });
      }, true)),
      flashArea());
    syncAmount();
  }

  function renderExpense(data) {
    if (!data) { mount(h('div', { class: 'empty', text: 'This transaction is not available.' })); return; }
    var group = data.group;
    var names = {};
    if (group) (group.participants || []).concat(group.payers || []).forEach(function (p) { names[p.userId] = p.displayName; });
    var history = h('div');
    mount(
      header(group ? 'Group expense · ' + group.name : 'Transaction', data.title,
        data.deleted ? h('span', { class: 'pill warn', text: 'Deleted' }) : group ? h('span', { class: 'pill', text: 'v' + group.version }) : null),
      h('section', { class: 'hero' },
        h('div', { class: 'big', text: money(data, 'amount') }),
        h('div', { class: 'muted' }, [date(data.occurredAt), data.merchant, data.categoryName, data.accountName].filter(Boolean).join(' · ')),
        data.note ? h('div', { text: data.note }) : null),
      data.items && data.items.length ? h('section', null, h('h3', { text: 'Line items', style: 'margin-bottom:6px' }), itemList(data.items, data.currency, names)) : null,
      group && (group.payers || []).length ? h('section', null, h('h3', { text: 'Paid by', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, group.payers.map(function (p) {
        return h('div', { class: 'row' }, h('span', { class: 'tile', text: initial(p.displayName) }), h('div', { class: 'grow title', text: p.displayName }), h('span', { class: 'amount', text: money(Object.assign({ currency: data.currency }, p), 'amount') }));
      }))) : null,
      group && (group.participants || []).length ? h('section', null, h('h3', { text: 'Split', style: 'margin-bottom:6px' }), h('div', { class: 'card' }, group.participants.map(function (p) {
        return h('div', { class: 'row' }, h('span', { class: 'tile', text: initial(p.displayName) }),
          h('div', { class: 'grow' }, h('div', { class: 'title', text: p.displayName }), h('div', { class: 'sub', text: p.method + (p.basisValue ? ' · ' + p.basisValue : '') })),
          h('span', { class: 'amount', text: money(Object.assign({ currency: data.currency }, p), 'amount') }));
      }))) : null,
      group ? h('div', { class: 'actions' }, actionButton('Show edit history', function () {
        return callTool('finapp.groups.expenses.history', { expenseId: data.id }).then(function (result) {
          history.textContent = '';
          history.appendChild(h('div', { class: 'card' }, ((result && result.events) || []).map(function (e) {
            return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: e.summary || e.kind }), h('div', { class: 'sub', text: e.actorName + ' · ' + date(e.createdAt) + ' · v' + e.version })));
          })));
          reportSize();
        });
      })) : null,
      history,
      flashArea());
  }

  function render() {
    if (state.error && !state.data) { mount(notice(state.error, 'error')); return; }
    if (!state.data) { mount(loading()); return; }
    try {
      if (state.view === 'overview') renderOverview(state.data);
      else if (state.view === 'transactions') renderTransactions(state.data);
      else if (state.view === 'groupBalances') renderBalances(state.data);
      else if (state.view === 'settleUp') renderSettleUp(state.data);
      else if (state.view === 'expense') renderExpense(state.data);
    } catch (error) {
      mount(notice('Could not display this result. The full details are in the chat.', 'error'));
    }
  }

  // ---------- Boot ----------
  applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  render();
  if (window.openai) {
    applyTheme(window.openai.theme);
    if (window.openai.toolOutput) receive({ structuredContent: window.openai.toolOutput });
    window.addEventListener('openai:set_globals', function (event) {
      var globals = (event.detail && event.detail.globals) || {};
      if (globals.theme) applyTheme(globals.theme);
      if (globals.toolOutput) receive({ structuredContent: globals.toolOutput });
    });
  }
  request('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'finapp-' + kind, version: '1.0.0' },
    clientInfo: { name: 'finapp-' + kind, version: '1.0.0' },
    appCapabilities: { availableDisplayModes: ['inline'] },
    capabilities: {}
  }).then(function (result) {
    bridgeReady = true;
    applyContext(result && result.hostContext);
    notify('ui/notifications/initialized', {});
    reportSize();
  }).catch(function () { /* Not an MCP Apps host; the openai globals path (if any) is used. */ });
})();
`;
