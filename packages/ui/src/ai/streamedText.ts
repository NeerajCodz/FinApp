/**
 * Smooth live rendering of a streamed FinAI reply (web and native).
 *
 * The backend writes the growing reply every ~80ms, so text arrives in uneven chunks. Instead of
 * jumping by a whole chunk, the visible text grows frame by frame at a rate that scales with the
 * backlog: never slower than a reading pace, and always caught up within about `CATCH_UP_S`.
 * Messages that were already finished when they mounted render in full immediately.
 */
import * as React from 'react';

const MIN_CHARS_PER_S = 60;
const CATCH_UP_S = 0.5;

/** Reveal speed for a new chunk: the whole backlog in `CATCH_UP_S`, never below reading pace. */
export function revealRate(backlog: number): number {
  return Math.max(MIN_CHARS_PER_S, backlog / CATCH_UP_S);
}

/** How many characters to show after `dtMs` at `rate` chars/s, given `shown` and `target`. */
export function revealStep(shown: number, target: number, dtMs: number, rate: number): number {
  if (target - shown <= 0) return target;
  return Math.min(target, shown + Math.max(1, Math.round((rate * dtMs) / 1000)));
}

/**
 * Closes Markdown left open by a cut-off stream (a fence, inline code, bold or italics), so a
 * partial reply renders with its final formatting instead of flashing raw markers.
 */
export function balancePartialMarkdown(text: string): string {
  const fences = (text.match(/^```/gm) ?? []).length;
  if (fences % 2 === 1) return `${text}\n\`\`\``;
  // Inline markers are only counted outside fenced code.
  const prose = text.replace(/^```[\s\S]*?^```/gm, '');
  let tail = '';
  if ((prose.match(/`/g) ?? []).length % 2 === 1) tail += '`';
  const withoutCode = prose.replace(/`[^`]*`?/g, '');
  const bold = (withoutCode.match(/\*\*/g) ?? []).length;
  if (bold % 2 === 1) tail += '**';
  // Single `*` emphasis, ignoring `*` list bullets at the start of a line.
  const singles = (
    withoutCode
      .replace(/\*\*/g, '')
      .replace(/^\s*\*\s/gm, '')
      .match(/\*/g) ?? []
  ).length;
  if (singles % 2 === 1) tail += '*';
  // An opener with nothing after it yet would render as empty emphasis: hold it back instead.
  const opener = /(\*\*|\*|`)$/.exec(text)?.[1];
  if (opener && tail.endsWith(opener))
    return text.slice(0, -opener.length) + tail.slice(0, -opener.length);
  return text + tail;
}

/** The part of `text` to show right now while a reply streams. */
export function useStreamedText(text: string, streaming: boolean): string {
  // Only replies seen streaming animate; history renders in full.
  const animate = React.useRef(streaming);
  if (streaming) animate.current = true;
  const [shown, setShown] = React.useState(() => (streaming ? 0 : text.length));
  const target = text.length;

  const shownRef = React.useRef(shown);
  shownRef.current = shown;

  React.useEffect(() => {
    if (!animate.current) return;
    if (shownRef.current >= target) return;
    const rate = revealRate(target - shownRef.current);
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 100) : 16;
      last = now;
      setShown((current) => {
        const next = revealStep(Math.min(current, target), target, dt, rate);
        if (next < target) frame = requestAnimationFrame(tick);
        return next;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  if (!animate.current || shown >= target) return text;
  return balancePartialMarkdown(text.slice(0, shown));
}
