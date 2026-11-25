/**
 * A small, safe Markdown subset for FinAI replies, parsed into plain data that the web and
 * native renderers turn into elements (never HTML strings).
 *
 * Blocks: paragraphs, `#`–`###` headings, `-`/`*`/`+` bullet lists, `1.` numbered lists,
 * `>` quotes and fenced code. Inline: `**bold**`, `*italic*` / `_italic_`, `` `code` ``.
 * Links are kept as text (FinAI replies never need clickable links).
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'em'; children: MdInline[] }
  | { type: 'code'; text: string };

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: MdInline[] }
  | { type: 'list'; ordered: boolean; start: number; items: MdInline[][] }
  | { type: 'quote'; children: MdInline[] }
  | { type: 'code'; text: string };

const BULLET = /^\s*[-*+•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*```/;

/** Inline markup to nodes. Unmatched markers stay as literal text. */
export function parseInline(source: string): MdInline[] {
  const nodes: MdInline[] = [];
  let text = '';
  const flush = () => {
    if (text) nodes.push({ type: 'text', text });
    text = '';
  };
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    if (rest.startsWith('`')) {
      const end = source.indexOf('`', index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ type: 'code', text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2);
      const end = source.indexOf(marker, index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({ type: 'strong', children: parseInline(source.slice(index + 2, end)) });
        index = end + 2;
        continue;
      }
    }
    if ((rest[0] === '*' || rest[0] === '_') && rest[1] && rest[1] !== ' ') {
      const marker = rest[0];
      const end = source.indexOf(marker, index + 1);
      // `_` inside words (snake_case) is not emphasis.
      const wordBefore = marker === '_' && /\w/.test(source[index - 1] ?? '');
      if (end > index + 1 && source[end - 1] !== ' ' && !wordBefore) {
        flush();
        nodes.push({ type: 'em', children: parseInline(source.slice(index + 1, end)) });
        index = end + 1;
        continue;
      }
    }
    // [label](url) → label
    if (rest[0] === '[') {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
      if (link) {
        text += link[1];
        index += link[0].length;
        continue;
      }
    }
    text += rest[0];
    index += 1;
  }
  flush();
  return nodes;
}

export function parseMarkdown(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  const flushParagraph = () => {
    const joined = paragraph.join('\n').trim();
    if (joined) blocks.push({ type: 'paragraph', children: parseInline(joined) });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (FENCE.test(line)) {
      flushParagraph();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index]!)) body.push(lines[index++]!);
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        children: parseInline(heading[2]!.trim()),
      });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !bullet;
      const items: MdInline[][] = [];
      const start = numbered ? Number(numbered[1]) : 1;
      while (index < lines.length) {
        const current = lines[index]!;
        const match = ordered ? NUMBERED.exec(current) : BULLET.exec(current);
        if (match) {
          items.push(parseInline((ordered ? match[2] : match[1])!.trim()));
          index += 1;
        } else if (current.trim() && /^\s{2,}\S/.test(current) && items.length) {
          // A wrapped continuation line belongs to the previous item.
          items[items.length - 1]!.push(
            { type: 'text', text: ' ' },
            ...parseInline(current.trim()),
          );
          index += 1;
        } else break;
      }
      index -= 1;
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      flushParagraph();
      blocks.push({ type: 'quote', children: parseInline(quote[1]!.trim()) });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}
