#!/usr/bin/env node
/**
 * FinApp versioning. `version.json` is the only place versions are written by hand (or by
 * `bump`); everything else is generated from it:
 *
 *   package.json (root)               product version
 *   apps/web/package.json             components.web
 *   apps/mobile/package.json          components.mobile
 *   apps/mobile/app.json              expo.version, android.versionCode, ios.buildNumber
 *   packages/ui/package.json          components.ui
 *   convex/shared/version.ts          BACKEND_INFO + product/component versions (generated)
 *   releases/v<product>.json          archived manifest of what shipped together
 *
 * Usage:
 *   node scripts/version.mjs sync                 write every derived file
 *   node scripts/version.mjs check                fail if any derived file is out of date (CI)
 *   node scripts/version.mjs bump <target> <type> target: product|web|mobile|ui|backend|all
 *                                                 type:   patch|minor|major
 *   node scripts/version.mjs build <android|ios>  increment a store build number
 *   node scripts/version.mjs show                 print the manifest
 *   node scripts/version.mjs tags                 print the git tags for this release
 *   node scripts/version.mjs adopt                take web/mobile/ui versions written by
 *                                                 `changeset version` into version.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...parts) => join(root, ...parts);
const COMPONENTS = ['web', 'mobile', 'ui', 'backend'];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function readJson(file) {
  return JSON.parse(readFileSync(path(file), 'utf8'));
}

/** Queues a derived file for formatting and comparison. */
function writeText(file, text, outputs) {
  outputs.push({ file, text });
}

/**
 * Formats every queued file with the repo's Prettier config and compares it with what is on
 * disk, ignoring line endings (the repo checks out with CRLF on Windows); writes keep each
 * file's existing line endings.
 */
async function resolveOutputs(outputs) {
  return Promise.all(
    outputs.map(async ({ file, text }) => {
      const target = path(file);
      const options = (await prettier.resolveConfig(target)) ?? {};
      const formatted = /\.(json|ts|mjs|js)$/.test(file)
        ? await prettier.format(text, { ...options, filepath: target })
        : text;
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : null;
      const eol = existing?.includes('\r\n') ? '\r\n' : '\n';
      const changed = existing?.replace(/\r\n/g, '\n') !== formatted.replace(/\r\n/g, '\n');
      return {
        file,
        changed,
        write: () => {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, formatted.replace(/\r?\n/g, eol));
        },
      };
    }),
  );
}

function writeJson(file, value, outputs) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`, outputs);
}

function validate(manifest) {
  const errors = [];
  if (!SEMVER.test(manifest.version)) errors.push(`version "${manifest.version}" is not SemVer`);
  for (const name of COMPONENTS)
    if (!SEMVER.test(manifest.components?.[name] ?? ''))
      errors.push(`components.${name} is missing or not SemVer`);
  for (const store of ['android', 'ios'])
    if (!Number.isInteger(manifest.build?.[store]) || manifest.build[store] < 1)
      errors.push(`build.${store} must be a positive integer`);
  const compat = manifest.compatibility ?? {};
  for (const key of ['minimumMobileVersion', 'minimumWebVersion'])
    if (!SEMVER.test(compat[key] ?? '')) errors.push(`compatibility.${key} is not SemVer`);
  for (const key of ['apiVersion', 'schemaVersion'])
    if (!Number.isInteger(compat[key])) errors.push(`compatibility.${key} must be an integer`);
  if (compareVersions(compat.minimumMobileVersion, manifest.components.mobile) > 0)
    errors.push('compatibility.minimumMobileVersion is newer than components.mobile');
  if (compareVersions(compat.minimumWebVersion, manifest.components.web) > 0)
    errors.push('compatibility.minimumWebVersion is newer than components.web');
  if (errors.length) {
    console.error(`version.json is invalid:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
}

export function compareVersions(left, right) {
  const a = SEMVER.exec(left);
  const b = SEMVER.exec(right);
  if (!a || !b) return 0;
  for (let index = 1; index <= 3; index++) {
    const diff = Number(a[index]) - Number(b[index]);
    if (diff) return Math.sign(diff);
  }
  if (a[4] && !b[4]) return -1;
  if (!a[4] && b[4]) return 1;
  return (a[4] ?? '').localeCompare(b[4] ?? '');
}

function bumpVersion(version, type) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Cannot bump "${version}"`);
  let [major, minor, patch] = match.slice(1, 4).map(Number);
  if (type === 'major') [major, minor, patch] = [major + 1, 0, 0];
  else if (type === 'minor') [minor, patch] = [minor + 1, 0];
  else if (type === 'patch') patch += 1;
  else throw new Error(`Unknown bump type "${type}" (patch|minor|major)`);
  return `${major}.${minor}.${patch}`;
}

function generatedVersionModule(manifest) {
  const { components, compatibility, build } = manifest;
  return `/**
 * GENERATED by \`node scripts/version.mjs sync\` from version.json — do not edit by hand.
 * Run \`bun run version:sync\` after changing version.json.
 */

/** The FinApp product release these components shipped in. */
export const PRODUCT_VERSION = '${manifest.version}';
export const RELEASE_CHANNEL = '${manifest.channel}';

/** Independent component versions (SemVer). */
export const COMPONENT_VERSIONS = {
  web: '${components.web}',
  mobile: '${components.mobile}',
  ui: '${components.ui}',
  backend: '${components.backend}',
} as const;

/** Store build numbers for the current mobile version. */
export const BUILD_NUMBERS = { android: ${build.android}, ios: ${build.ios} } as const;

/**
 * What the running backend speaks. Clients compare their own version with the minimums and
 * ask to update (mobile) or reload (web) when they are older.
 */
export const BACKEND_INFO = {
  version: '${components.backend}',
  apiVersion: ${compatibility.apiVersion},
  schemaVersion: ${compatibility.schemaVersion},
  minimumMobileVersion: '${compatibility.minimumMobileVersion}',
  minimumWebVersion: '${compatibility.minimumWebVersion}',
} as const;

/** Display string kept for existing callers ("v1.4.0"). */
export const APP_VERSION = \`v\${PRODUCT_VERSION}\`;

/** -1, 0 or 1 comparing two SemVer strings (pre-releases sort before releases). */
export function compareVersions(left: string, right: string): number {
  const pattern = /^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z.-]+))?$/;
  const a = pattern.exec(left);
  const b = pattern.exec(right);
  if (!a || !b) return 0;
  for (let index = 1; index <= 3; index++) {
    const diff = Number(a[index]) - Number(b[index]);
    if (diff) return Math.sign(diff);
  }
  if (a[4] && !b[4]) return -1;
  if (!a[4] && b[4]) return 1;
  return (a[4] ?? '').localeCompare(b[4] ?? '');
}
`;
}

function derivedOutputs(manifest) {
  const outputs = [];

  const rootPackage = readJson('package.json');
  writeJson('package.json', { ...rootPackage, version: manifest.version }, outputs);
  for (const [file, component] of [
    ['apps/web/package.json', 'web'],
    ['apps/mobile/package.json', 'mobile'],
    ['packages/ui/package.json', 'ui'],
  ]) {
    const pkg = readJson(file);
    writeJson(file, { ...pkg, version: manifest.components[component] }, outputs);
  }

  const app = readJson('apps/mobile/app.json');
  app.expo.version = manifest.components.mobile;
  app.expo.android = { ...app.expo.android, versionCode: manifest.build.android };
  app.expo.ios = { ...app.expo.ios, buildNumber: String(manifest.build.ios) };
  writeJson('apps/mobile/app.json', app, outputs);

  writeText('convex/shared/version.ts', generatedVersionModule(manifest), outputs);

  const releaseFile = `releases/v${manifest.version}.json`;
  const existing = existsSync(path(releaseFile)) ? readJson(releaseFile) : null;
  writeJson(
    releaseFile,
    {
      version: manifest.version,
      channel: manifest.channel,
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      components: manifest.components,
      build: manifest.build,
      compatibility: manifest.compatibility,
      tags: releaseTags(manifest),
    },
    outputs,
  );
  return outputs;
}

function releaseTags(manifest) {
  return [
    `finapp-v${manifest.version}`,
    ...COMPONENTS.map((name) => `${name}-v${manifest.components[name]}`),
  ];
}

async function saveManifest(manifest) {
  const outputs = [];
  writeJson('version.json', manifest, outputs);
  (await resolveOutputs(outputs)).forEach((output) => output.write());
}

async function writeDerived(manifest) {
  const outputs = await resolveOutputs(derivedOutputs(manifest));
  outputs.filter((output) => output.changed).forEach((output) => output.write());
  return outputs;
}

const [command = 'show', ...args] = process.argv.slice(2);
const manifest = readJson('version.json');
validate(manifest);

if (command === 'show') {
  console.log(JSON.stringify(manifest, null, 2));
} else if (command === 'tags') {
  console.log(releaseTags(manifest).join('\n'));
} else if (command === 'sync' || command === 'check') {
  const outputs = await resolveOutputs(derivedOutputs(manifest));
  const stale = outputs.filter((output) => output.changed);
  if (command === 'check') {
    if (stale.length) {
      console.error(
        `Out of date with version.json: ${stale.map((o) => o.file).join(', ')}\nRun: bun run version:sync`,
      );
      process.exit(1);
    }
    console.log(`Versions in sync (FinApp ${manifest.version}).`);
  } else {
    stale.forEach((output) => output.write());
    console.log(
      stale.length ? `Updated: ${stale.map((o) => o.file).join(', ')}` : 'Already in sync.',
    );
  }
} else if (command === 'bump') {
  const [target, type] = args;
  const targets = target === 'all' ? ['product', ...COMPONENTS] : [target];
  for (const name of targets) {
    if (name === 'product') manifest.version = bumpVersion(manifest.version, type);
    else if (COMPONENTS.includes(name))
      manifest.components[name] = bumpVersion(manifest.components[name], type);
    else throw new Error(`Unknown target "${name}" (product|web|mobile|ui|backend|all)`);
  }
  // A new mobile version needs a new store build.
  if (targets.includes('mobile')) {
    manifest.build.android += 1;
    manifest.build.ios += 1;
  }
  await saveManifest(manifest);
  await writeDerived(manifest);
  console.log(`Bumped ${targets.join(', ')} (${type}). FinApp ${manifest.version}.`);
} else if (command === 'adopt') {
  // Changesets bumps package.json versions; version.json stays the source of truth, so pull
  // them back in (mobile bumps get a new store build), then regenerate everything else.
  const before = { ...manifest.components };
  for (const [file, component] of [
    ['apps/web/package.json', 'web'],
    ['apps/mobile/package.json', 'mobile'],
    ['packages/ui/package.json', 'ui'],
  ])
    manifest.components[component] = readJson(file).version;
  if (manifest.components.mobile !== before.mobile) {
    manifest.build.android += 1;
    manifest.build.ios += 1;
  }
  await saveManifest(manifest);
  await writeDerived(manifest);
  const changed = COMPONENTS.filter((name) => before[name] !== manifest.components[name]);
  console.log(changed.length ? `Adopted ${changed.join(', ')}.` : 'Nothing to adopt.');
} else if (command === 'build') {
  const [store] = args;
  if (store !== 'android' && store !== 'ios') throw new Error('build <android|ios>');
  manifest.build[store] += 1;
  await saveManifest(manifest);
  await writeDerived(manifest);
  console.log(`${store} build ${manifest.build[store]}.`);
} else {
  console.error(`Unknown command "${command}". See the header of scripts/version.mjs.`);
  process.exit(1);
}
