#!/usr/bin/env node
/**
 * Builds the GitHub release notes for a product version from every changelog:
 *
 *   CHANGELOG.md                 product highlights (the `## <version>` section)
 *   apps/web/CHANGELOG.md        web component section for components.web
 *   apps/mobile/CHANGELOG.md     mobile section for components.mobile
 *   packages/ui/CHANGELOG.md     ui section for components.ui
 *   convex/CHANGELOG.md          backend section for components.backend
 *
 * The Release workflow appends GitHub's generated list of merged pull requests and attaches
 * version.json. Usage: node scripts/release-notes.mjs [version.json path] > notes.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = process.argv[2] ?? join(root, 'version.json');
/**
 * Wraps `@name` in backticks outside code spans so release notes never mention (link, notify or
 * credit) a GitHub account by accident — e.g. the `@finai` chat mention. Emails are left alone,
 * and GitHub's own "by @author in #123" credits are kept.
 */
export function escapeMentions(markdown) {
  return markdown
    .split(/(`[^`\n]*`)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(/(^|[^\w`])@([A-Za-z0-9][\w-]*)/g, (match, before, name, offset, text) =>
            /\bby $/.test(text.slice(0, offset + before.length)) &&
            /^ in /.test(text.slice(offset + match.length))
              ? match
              : `${before}\`@${name}\``,
          ),
    )
    .join('');
}

if (process.argv[2] === '--escape') {
  process.stdout.write(escapeMentions(readFileSync(0, 'utf8')));
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

/** The body of `## <version>` in a changelog, without the heading ('' when missing). */
export function section(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim();
}

const read = (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '');

const components = [
  ['Web', 'apps/web/CHANGELOG.md', manifest.components.web],
  ['Mobile', 'apps/mobile/CHANGELOG.md', manifest.components.mobile],
  ['UI library', 'packages/ui/CHANGELOG.md', manifest.components.ui],
  ['Backend', 'convex/CHANGELOG.md', manifest.components.backend],
];

const out = [];
const highlights = section(read('CHANGELOG.md'), manifest.version);
out.push(highlights || `FinApp ${manifest.version}.`);

const componentNotes = components
  .map(([name, file, version]) => {
    const body = section(read(file), version);
    return body ? `### ${name} ${version}\n\n${body}` : '';
  })
  .filter(Boolean);
if (componentNotes.length) out.push('## Components', ...componentNotes);

const download = (file) =>
  `https://github.com/NeerajCodz/FinApp/releases/download/finapp-v${manifest.version}/${file}`;
const apk = `finapp-v${manifest.version.replace(/\./g, '_')}`;
out.push(
  '## Android',
  [
    'APKs are attached once the Android release is approved (Android APKs workflow):',
    '',
    `- [\`${apk}.apk\`](${download(`${apk}.apk`)}): universal, works on every device`,
    `- [\`${apk}-arm64-v8a.apk\`](${download(`${apk}-arm64-v8a.apk`)}): most phones (64-bit ARM)`,
    `- [\`${apk}-armeabi-v7a.apk\`](${download(`${apk}-armeabi-v7a.apk`)}): older 32-bit phones`,
    `- [\`${apk}-x86_64.apk\`](${download(`${apk}-x86_64.apk`)}) / [\`${apk}-x86.apk\`](${download(`${apk}-x86.apk`)}): emulators and x86 devices`,
    `- [\`SHA256SUMS.txt\`](${download('SHA256SUMS.txt')})`,
  ].join('\n'),
);

out.push(
  '## Versions',
  [
    '| Component | Version |',
    '| --- | --- |',
    `| Web | ${manifest.components.web} |`,
    `| Mobile | ${manifest.components.mobile} (Android ${manifest.build.android}, iOS ${manifest.build.ios}) |`,
    `| UI library | ${manifest.components.ui} |`,
    `| Backend | ${manifest.components.backend} |`,
    `| API / schema | ${manifest.compatibility.apiVersion} / ${manifest.compatibility.schemaVersion} |`,
    `| Minimum mobile / web | ${manifest.compatibility.minimumMobileVersion} / ${manifest.compatibility.minimumWebVersion} |`,
  ].join('\n'),
  `The full manifest is attached as [\`version.json\`](https://github.com/NeerajCodz/FinApp/releases/download/finapp-v${manifest.version}/version.json).`,
);

process.stdout.write(`${escapeMentions(out.join('\n\n'))}\n`);
