import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKEND_INFO,
  BUILD_NUMBERS,
  COMPONENT_VERSIONS,
  PRODUCT_VERSION,
  compareVersions,
} from '../../convex/shared/version';
import { diagnosticsText, updateRequired, versionRows } from '../../packages/ui/src/version/model';

const root = join(__dirname, '..', '..');
const json = (file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const compareScriptVersions = (left: string, right: string) =>
  Number(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `process.argv[2] = 'show'; const { compareVersions } = await import(${JSON.stringify(
          new URL('../../scripts/version.mjs', import.meta.url).href,
        )}); console.log(compareVersions(${JSON.stringify(left)}, ${JSON.stringify(right)}));`,
      ],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .at(-1),
  );
describe('version manifest', () => {
  it('is the source every generated file agrees with', () => {
    const manifest = json('version.json');
    expect(PRODUCT_VERSION).toBe(manifest.version);
    expect(COMPONENT_VERSIONS).toEqual(manifest.components);
    expect(BACKEND_INFO.minimumWebVersion).toBe(manifest.compatibility.minimumWebVersion);
    expect(json('apps/web/package.json').version).toBe(manifest.components.web);
    expect(json('apps/mobile/package.json').version).toBe(manifest.components.mobile);
    expect(json('packages/ui/package.json').version).toBe(manifest.components.ui);
    expect(json('apps/mobile/app.json').expo.android.versionCode).toBe(manifest.build.android);
  });
});

describe('compareVersions', () => {
  it('orders SemVer, pre-releases first', () => {
    expect(compareVersions('1.4.0', '1.3.9')).toBe(1);
    expect(compareVersions('1.4.0', '1.4.0')).toBe(0);
    expect(compareVersions('1.4.0-rc.1', '1.4.0')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1);
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.alpha')).toBe(-1);
  });

  it('orders prerelease identifiers by SemVer numeric and lexical rules', () => {
    expect(compareScriptVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1);
    expect(compareScriptVersions('1.0.0-rc.2', '1.0.0-rc.alpha')).toBe(-1);
    expect(compareScriptVersions('1.0.0-rc.alpha', '1.0.0-rc.beta')).toBe(-1);
    expect(compareScriptVersions('1.0.0-rc', '1.0.0-rc.1')).toBe(-1);
  });
});

describe('client compatibility', () => {
  const backend = { ...BACKEND_INFO, productVersion: PRODUCT_VERSION };
  it('asks for an update only when older than the backend minimum', () => {
    expect(updateRequired('mobile', backend)).toBe(false);
    expect(updateRequired('mobile', { ...backend, minimumMobileVersion: '99.0.0' })).toBe(true);
    expect(updateRequired('web', undefined)).toBeNull();
  });

  it('lists every version for diagnostics', () => {
    const rows = versionRows({
      platform: 'web',
      backend,
      commit: 'abc1234',
      environment: 'production',
    });
    const text = diagnosticsText(rows);
    expect(text).toContain(`FinApp: ${PRODUCT_VERSION}`);
    expect(text).toContain(`Backend: ${BACKEND_INFO.version}`);
    expect(text).toContain('Commit: abc1234');
  });

  it('reports the installed build number for the current native platform', () => {
    expect(
      versionRows({ platform: 'mobile', backend, nativePlatform: 'android' }).find(
        (row) => row.label === 'Build',
      )?.value,
    ).toBe(`${BUILD_NUMBERS.android} (Android)`);
    expect(
      versionRows({ platform: 'mobile', backend, nativePlatform: 'ios' }).find(
        (row) => row.label === 'Build',
      )?.value,
    ).toBe(`${BUILD_NUMBERS.ios} (iOS)`);
  });
});
