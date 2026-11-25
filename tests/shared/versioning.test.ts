import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKEND_INFO,
  COMPONENT_VERSIONS,
  PRODUCT_VERSION,
  compareVersions,
} from '../../convex/shared/version';
import { diagnosticsText, updateRequired, versionRows } from '../../packages/ui/src/version/model';

const root = join(__dirname, '..', '..');
const json = (file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'));

describe('version manifest', () => {
  it('is the source every generated file agrees with', () => {
    const manifest = json('version.json');
    expect(PRODUCT_VERSION).toBe(manifest.version);
    expect(COMPONENT_VERSIONS).toEqual(manifest.components);
    expect(json('apps/web/package.json').version).toBe(manifest.components.web);
    expect(json('apps/mobile/package.json').version).toBe(manifest.components.mobile);
    expect(json('packages/ui/package.json').version).toBe(manifest.components.ui);
    expect(json('apps/mobile/app.json').expo.android.versionCode).toBe(manifest.build.android);
    expect(readFileSync(join(root, 'version.txt'), 'utf8').trim()).toBe(manifest.version);
    expect(json(`releases/v${manifest.version}.json`).components).toEqual(manifest.components);
  });
});

describe('compareVersions', () => {
  it('orders SemVer, pre-releases first', () => {
    expect(compareVersions('1.4.0', '1.3.9')).toBe(1);
    expect(compareVersions('1.4.0', '1.4.0')).toBe(0);
    expect(compareVersions('1.4.0-rc.1', '1.4.0')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
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
});
