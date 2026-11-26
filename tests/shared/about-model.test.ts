import { describe, expect, it } from 'vitest';
import { BACKEND_INFO, PRODUCT_VERSION } from '../../convex/shared/version';
import {
  RELEASE_NOTES,
  releaseNotesFor,
  releaseUrl,
  updateState,
  type LiveBackendInfo,
} from '../../packages/ui/src/version/model';

const backend = (overrides: Partial<LiveBackendInfo> = {}): LiveBackendInfo => ({
  ...BACKEND_INFO,
  productVersion: PRODUCT_VERSION,
  ...overrides,
});

describe('about: update state', () => {
  it('reports checking, offline, current, newer and required', () => {
    expect(updateState('web', undefined)).toEqual({ kind: 'checking' });
    expect(updateState('mobile', null)).toEqual({ kind: 'offline' });
    expect(updateState('web', backend())).toEqual({ kind: 'current' });
    expect(updateState('web', backend({ productVersion: '99.0.0' }))).toEqual({
      kind: 'newer',
      latest: '99.0.0',
    });
    expect(
      updateState('mobile', backend({ productVersion: '99.0.0', minimumMobileVersion: '99.0.0' })),
    ).toEqual({ kind: 'required', latest: '99.0.0' });
  });
});

describe('about: release notes', () => {
  it('finds a release or falls back to the newest notes', () => {
    expect(releaseNotesFor('1.10.0')?.version).toBe('1.10.0');
    expect(releaseNotesFor('0.0.1')).toBe(RELEASE_NOTES[0]);
    for (const notes of RELEASE_NOTES) expect(notes.highlights.length).toBeGreaterThan(0);
    expect(releaseUrl('1.10.1')).toMatch(/releases\/tag\/finapp-v1\.10\.1$/);
  });
});
