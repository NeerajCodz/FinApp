/**
 * Markdown → HTML for docs pages (build time): GFM via marked, code highlighting via shiki with
 * light/dark themes, heading anchors and a table of contents, plus two block extensions:
 *
 *   :::note | :::tip | :::warning   callouts
 *   :::tabs                         fenced code blocks with title="Label" become tabs
 */
import { Marked, type Tokens } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';

export type TocEntry = { id: string; text: string; depth: 2 | 3 };
export type Rendered = { html: string; toc: TocEntry[] };

const LANGS = [
  'bash',
  'shell',
  'json',
  'jsonc',
  'javascript',
  'typescript',
  'tsx',
  'python',
  'http',
  'yaml',
  'dotenv',
  'diff',
  'markdown',
  'ini',
  'dockerfile',
] as const;
const ALIASES: Record<string, string> = {
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  curl: 'bash',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  yml: 'yaml',
  env: 'dotenv',
  md: 'markdown',
};

let highlighterPromise: Promise<Highlighter> | null = null;
function highlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...LANGS],
  });
  return highlighterPromise;
}

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section'
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function codeBlock(hl: Highlighter | null, code: string, info: string | undefined) {
  const [rawLang = 'text', ...rest] = (info ?? '').trim().split(/\s+/);
  const title = /title="([^"]*)"/.exec(rest.join(' '))?.[1];
  const wanted = ALIASES[rawLang] ?? rawLang;
  const lang = (LANGS as readonly string[]).includes(wanted) ? wanted : 'text';
  // Plain blocks (no highlighter) keep very large generated pages light.
  const highlighted = hl
    ? hl.codeToHtml(code.replace(/\n$/, ''), {
        lang,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      })
    : `<pre class="shiki plain"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`;
  return {
    title,
    html: `<div class="code-block"><div class="code-head"><span>${escapeHtml(title ?? rawLang)}</span><button type="button" class="copy" data-copy aria-label="Copy code">Copy</button></div>${highlighted}</div>`,
  };
}

/** Splits `:::name … :::` containers out of the source (fences inside are respected). */
function splitContainers(source: string) {
  const lines = source.split('\n');
  const parts: { kind: string; text: string; arg?: string }[] = [];
  let buffer: string[] = [];
  let index = 0;
  const flush = () => {
    if (buffer.length) parts.push({ kind: 'md', text: buffer.join('\n') });
    buffer = [];
  };
  let inFence = false;
  while (index < lines.length) {
    const line = lines[index]!;
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const open = !inFence ? /^:::(note|tip|warning|tabs)\s*(.*)$/.exec(line.trim()) : null;
    if (open) {
      flush();
      const inner: string[] = [];
      let fence = false;
      index += 1;
      while (index < lines.length) {
        const current = lines[index]!;
        if (/^\s*(```|~~~)/.test(current)) fence = !fence;
        if (!fence && current.trim() === ':::') break;
        inner.push(current);
        index += 1;
      }
      parts.push({ kind: open[1]!, arg: open[2] ?? '', text: inner.join('\n') });
      index += 1;
      continue;
    }
    buffer.push(line);
    index += 1;
  }
  flush();
  return parts;
}

let tabGroup = 0;

export async function renderMarkdown(source: string): Promise<Rendered> {
  const hl = await highlighter();
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugify(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token) {
        const inner = this.parser.parseInline(token.tokens);
        const plain = inner.replace(/<[^>]+>/g, '');
        const id = uniqueId(plain);
        if (token.depth === 2 || token.depth === 3)
          toc.push({ id, text: plain, depth: token.depth });
        return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
      },
      code(token) {
        return codeBlock(hl, token.text, token.lang).html;
      },
      link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token) {
        const text = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//.test(token.href);
        return `<a href="${escapeHtml(token.href)}"${token.title ? ` title="${escapeHtml(token.title)}"` : ''}${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
      },
    },
  });

  const render = (text: string) =>
    (marked.parse(text, { async: false }) as string)
      .replace(/<table>/g, '<div class="table-wrap"><table>')
      .replace(/<\/table>/g, '</table></div>');

  const html = splitContainers(source.replace(/\r\n/g, '\n'))
    .map((part) => {
      if (part.kind === 'md') return render(part.text);
      if (part.kind === 'tabs') {
        const blocks = [...part.text.matchAll(/^(```|~~~)([^\n]*)\n([\s\S]*?)^\1\s*$/gm)];
        if (!blocks.length) return render(part.text);
        tabGroup += 1;
        const rendered = blocks.map((block) => codeBlock(hl, block[3]!, block[2]));
        const labels = rendered.map((block, index) => block.title ?? `Tab ${index + 1}`);
        return `<div class="tabs" data-tabs><div class="tab-list" role="tablist">${labels
          .map(
            (label, index) =>
              `<button type="button" role="tab" data-tab="${escapeHtml(label)}" aria-selected="${index === 0}" id="tabs-${tabGroup}-${index}">${escapeHtml(label)}</button>`,
          )
          .join('')}</div>${rendered
          .map(
            (block, index) =>
              `<div class="tab-panel" role="tabpanel" data-panel="${escapeHtml(labels[index]!)}" aria-labelledby="tabs-${tabGroup}-${index}"${index === 0 ? '' : ' hidden'}>${block.html}</div>`,
          )
          .join('')}</div>`;
      }
      const label = part.kind === 'note' ? 'Note' : part.kind === 'tip' ? 'Tip' : 'Warning';
      return `<aside class="callout callout-${part.kind}"><strong>${part.arg ? escapeHtml(part.arg) : label}</strong>${render(part.text)}</aside>`;
    })
    .join('\n');
  return { html, toc };
}

/** Plain text for the search index. */
export function plainText(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^:::.*$/gm, ' ')
    .replace(/[#>*_`|[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A single unhighlighted snippet (used by the API reference to keep that page light). */
export function plainBlock(code: string, lang: string, title?: string) {
  return codeBlock(null, code, `${lang}${title ? ` title="${title}"` : ''}`).html;
}

/** Tabs of plain snippets (used by the API reference). */
export function codeTabs(blocks: { label: string; lang: string; code: string }[]) {
  tabGroup += 1;
  const group = tabGroup;
  const buttons = blocks
    .map(
      (block, index) =>
        `<button type="button" role="tab" data-tab="${escapeHtml(block.label)}" aria-selected="${index === 0}" id="tabs-${group}-${index}">${escapeHtml(block.label)}</button>`,
    )
    .join('');
  const panels = blocks
    .map(
      (block, index) =>
        `<div class="tab-panel" role="tabpanel" data-panel="${escapeHtml(block.label)}" aria-labelledby="tabs-${group}-${index}"${index === 0 ? '' : ' hidden'}>${plainBlock(block.code, block.lang, block.label)}</div>`,
    )
    .join('');
  return `<div class="tabs" data-tabs><div class="tab-list" role="tablist">${buttons}</div>${panels}</div>`;
}
