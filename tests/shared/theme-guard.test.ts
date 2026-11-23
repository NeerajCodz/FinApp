import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../packages/ui/src/', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('theme guard', () => {
  it('keeps colour literals out of UI components (tokens only)', () => {
    const offenders: string[] = [];
    for (const path of files(root)) {
      if (!path.endsWith('.tsx')) continue;
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/#[\da-f]{3,8}\b/i.test(line) && !line.includes('theme-exempt'))
            offenders.push(`${relative(root, path)}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(
      offenders,
      'Use theme tokens, or mark a deliberate literal with // theme-exempt',
    ).toEqual([]);
  });
});
