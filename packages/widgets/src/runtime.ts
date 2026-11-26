/**
 * Browser runtime shared by every widget document. Plain ES2017 JavaScript in a string (no
 * template interpolation) that expects these globals from the shell:
 *
 * - `KIT`   the instantiated kit (see kit.ts),
 * - `VIEWS` map of widget id → render(data, kit) → HTML string (the widget plus any `views`),
 * - `WIDGET` `{ id, title }`, and `EMPTY` the widget's empty data (used when a result is null).
 *
 * It talks to the host through the MCP Apps bridge (JSON-RPC over postMessage: ui/initialize,
 * ui/notifications/tool-result, host-context-changed, tools/call, ui/message, size-changed) and
 * falls back to the ChatGPT Apps SDK globals (window.openai.toolOutput / theme / callTool).
 * Rendered HTML only ever contains kit-escaped strings; tooltips and flashes use textContent.
 */
export const widgetRuntime = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app');
  var state = { data: undefined, view: WIDGET.id, error: null };

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
  function unwrap(content) { return content && typeof content === 'object' && 'data' in content ? content.data : content; }
  function textOf(result) {
    var blocks = (result && result.content) || [];
    for (var i = 0; i < blocks.length; i++) if (blocks[i] && blocks[i].type === 'text') return blocks[i].text;
    return '';
  }
  function receive(result) {
    if (!result) return;
    var content = unwrap(result.structuredContent);
    if (content === undefined) return;
    if (result.isError) state.error = textOf(result) || 'The request failed.';
    else { state.error = null; state.data = content; state.view = WIDGET.id; }
    render();
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
      return unwrap(result && result.structuredContent);
    });
  }
  function sendMessage(text) {
    if (bridgeReady) return request('ui/message', { role: 'user', content: { type: 'text', text: text } });
    if (window.openai && window.openai.sendFollowUpMessage) return Promise.resolve(window.openai.sendFollowUpMessage({ prompt: text }));
    return Promise.reject(new Error('This client cannot send messages from the widget.'));
  }
  var lastHeight = 0;
  function reportSize() {
    var height = Math.ceil(document.documentElement.scrollHeight);
    if (height === lastHeight) return;
    lastHeight = height;
    if (bridgeReady) notify('ui/notifications/size-changed', { width: Math.ceil(document.documentElement.scrollWidth), height: height });
  }
  if (window.ResizeObserver) new ResizeObserver(reportSize).observe(document.documentElement);

  // ---------- Rendering ----------
  function noticeHtml(text) { return '<div class="w">' + KIT.notice(text, 'expense') + '</div>'; }
  function loadingHtml() {
    return '<div class="w" aria-busy="true"><div class="skeleton" style="width:40%"></div><div class="card">' +
      '<div class="skeleton" style="width:70%;margin:6px 0"></div><div class="skeleton" style="width:55%;margin:12px 0 6px"></div></div></div>';
  }
  function draw(view, data) {
    var fn = VIEWS[view];
    if (!fn) throw new Error('Unknown view');
    return fn(data === null || data === undefined ? EMPTY : data, KIT);
  }
  function render() {
    hideTip();
    if (state.error && state.data === undefined) { root.innerHTML = noticeHtml(state.error); reportSize(); return; }
    if (state.data === undefined) { root.innerHTML = loadingHtml(); reportSize(); return; }
    try { root.innerHTML = draw(state.view, state.data); }
    catch (error) { root.innerHTML = noticeHtml('Could not display this result. The full details are in the chat.'); }
    reportSize();
  }

  // ---------- Tooltips ----------
  var tip = null;
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function showTip(target, x, y) {
    var text = target.getAttribute('data-tip');
    if (!text) return hideTip();
    if (!tip) { tip = document.createElement('div'); tip.id = 'fa-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = text;
    tip.style.display = 'block';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(window.innerWidth - w - 6, Math.max(6, x + 12));
    var top = y - h - 10 < 4 ? y + 16 : y - h - 10;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  document.addEventListener('pointermove', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-tip]') : null;
    if (target) showTip(target, event.clientX, event.clientY); else hideTip();
  });
  document.addEventListener('pointerleave', hideTip);

  // ---------- Actions ----------
  function flash(from, text, tone) {
    var scope = from.closest('.w') || root;
    var area = from.parentNode && from.parentNode.nextElementSibling && from.parentNode.nextElementSibling.hasAttribute('data-flash')
      ? from.parentNode.nextElementSibling : scope.querySelector('[data-flash]');
    if (!area) { area = document.createElement('div'); area.setAttribute('data-flash', ''); scope.appendChild(area); }
    area.innerHTML = KIT.notice(text, tone === 'error' ? 'expense' : 'income');
    reportSize();
  }
  function digits(currency) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).resolvedOptions().maximumFractionDigits; }
    catch (e) { return 2; }
  }
  function toMinor(text, currency) {
    var d = digits(currency);
    var clean = String(text).replace(/[,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    var parts = clean.split('.');
    var frac = parts[1] || '';
    if (frac.length > d) return null;
    while (frac.length < d) frac += '0';
    var joined = (parts[0] + frac).replace(/^0+(?=\d)/, '');
    return joined === '0' || joined === '' ? null : joined;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return ((Math.random() * 16) | 0).toString(16); });
  }
  function parse(text, fallback) { try { return text ? JSON.parse(text) : fallback; } catch (e) { return fallback; } }
  function fieldValue(form, name) {
    var el = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('[name="' + name + '"]');
    if (!el) return '';
    if (el.type === 'radio' && !el.checked) return '';
    return el.value;
  }
  function interpolate(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) { return values[key] === undefined ? '' : String(values[key]); });
  }
  function collect(button) {
    var args = parse(button.getAttribute('data-args'), {});
    var raw = {};
    Object.keys(args).forEach(function (key) { raw[key] = args[key]; });
    var spec = button.getAttribute('data-fields');
    var form = button.closest('form') || button.closest('.w') || root;
    var currency = button.getAttribute('data-currency') || args.currency;
    if (spec) spec.split(',').forEach(function (part) {
      var bits = part.trim().split(':');
      var name = bits[0], kind = bits[1] || '';
      var optional = /\?$/.test(name);
      name = name.replace(/\?$/, '');
      var value = String(fieldValue(form, name) || '').trim();
      if (!value) { if (optional) return; throw new Error('Please fill in ' + name + '.'); }
      if (kind === 'json') {
        var obj = parse(value, null);
        if (!obj) throw new Error('Choose an option.');
        Object.keys(obj).forEach(function (key) { if (key.charAt(0) === '_') raw[key.slice(1)] = obj[key]; else { args[key] = obj[key]; raw[key] = obj[key]; } });
        return;
      }
      raw[name] = value;
      if (kind === 'minor') {
        var minor = toMinor(value, currency);
        if (!minor) throw new Error('Enter a positive amount with at most ' + digits(currency) + ' decimals.');
        args[name] = minor;
      } else args[name] = value;
    });
    if (button.hasAttribute('data-mutation')) args.clientMutationId = uuid();
    return { args: args, raw: raw };
  }
  function okText(button, result, raw) {
    var spec = button.getAttribute('data-ok');
    if (!spec) return null;
    var map = spec.charAt(0) === '{' ? parse(spec, null) : null;
    var template = map ? (result && map[result.status]) || map['*'] : spec;
    return template ? interpolate(template, raw) : null;
  }
  root.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    var prompt = button.getAttribute('data-prompt');
    if (prompt) { sendMessage(prompt).catch(function (error) { flash(button, error.message, 'error'); }); return; }
    var tool = button.getAttribute('data-call');
    if (!tool) return;
    var input;
    try { input = collect(button); } catch (error) { flash(button, error.message, 'error'); return; }
    button.disabled = true;
    callTool(tool, input.args).then(function (result) {
      var view = button.getAttribute('data-view');
      var into = button.getAttribute('data-into');
      if (view && into) {
        var target = document.getElementById(into);
        if (target) target.innerHTML = draw(view, result);
      } else if (view) { state.data = result; state.view = view; render(); return; }
      var text = okText(button, result, input.raw);
      if (text) flash(button, text, 'ok');
      var say = button.getAttribute('data-say');
      if (say) sendMessage(interpolate(say, input.raw)).catch(function () {});
      if (button.hasAttribute('data-mutation')) button.setAttribute('data-done', '');
      else button.disabled = false;
      reportSize();
    }).catch(function (error) { button.disabled = false; flash(button, error.message || String(error), 'error'); });
  });
  root.addEventListener('submit', function (event) { event.preventDefault(); });
  root.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || !input.getAttribute) return;
    var fill = parse(input.getAttribute('data-fill'), null);
    if (!fill || !input.checked) return;
    var form = input.closest('form') || root;
    Object.keys(fill).forEach(function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = fill[name];
    });
  });

  // ---------- Boot ----------
  applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (window.__FINAPP_SAMPLE__ !== undefined) state.data = window.__FINAPP_SAMPLE__;
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
    appInfo: { name: 'finapp-' + WIDGET.id, version: '1.0.0' },
    clientInfo: { name: 'finapp-' + WIDGET.id, version: '1.0.0' },
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
