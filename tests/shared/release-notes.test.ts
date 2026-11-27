import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const escapeReleaseMentions = (text: string) =>
  execFileSync(process.execPath, ['scripts/release-notes.mjs', '--escape'], {
    cwd: root,
    encoding: 'utf8',
    input: text,
  });

describe('release note mention escaping', () => {
  it('escapes PR-title mentions but preserves GitHub-generated credits', () => {
    const notes = [
      '## What\'s Changed',
      '* Add `@finai` support by @titleauthor in https://github.com/acme/app/pull/12 by @actualauthor in https://github.com/acme/app/pull/12',
      '## New Contributors',
      '* @newauthor made their first contribution in https://github.com/acme/app/pull/13',
    ].join('\n');

    expect(escapeReleaseMentions(notes)).toBe(
      [
        '## What\'s Changed',
        '* Add `@finai` support by `@titleauthor` in https://github.com/acme/app/pull/12 by @actualauthor in https://github.com/acme/app/pull/12',
        '## New Contributors',
        '* @newauthor made their first contribution in https://github.com/acme/app/pull/13',
      ].join('\n'),
    );
  });

  it('does not preserve user-authored text that only resembles an author suffix', () => {
    expect(escapeReleaseMentions('* User wrote by @fake in #12').trim()).toBe(
      '* User wrote by `@fake` in #12',
    );
  });
});
