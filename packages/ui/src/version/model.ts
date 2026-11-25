/**
 * Version information shown on the About screens and copied as support diagnostics. Bundled
 * versions come from version.json (through convex/shared/version.ts); the backend's live
 * values come from `api.system.info`.
 */
import {
  BUILD_NUMBERS,
  COMPONENT_VERSIONS,
  PRODUCT_VERSION,
  RELEASE_CHANNEL,
  compareVersions,
} from '@convex/shared/version';

export type LiveBackendInfo = {
  version: string;
  apiVersion: number;
  schemaVersion: number;
  minimumMobileVersion: string;
  minimumWebVersion: string;
  productVersion: string;
};

export type VersionRow = { label: string; value: string };

export function versionRows(input: {
  platform: 'web' | 'mobile';
  backend: LiveBackendInfo | null | undefined;
  commit?: string;
  environment?: string;
}): VersionRow[] {
  const backend = input.backend;
  const rows: VersionRow[] = [
    { label: 'FinApp', value: `${PRODUCT_VERSION} (${RELEASE_CHANNEL})` },
    {
      label: input.platform === 'web' ? 'Web app' : 'Mobile app',
      value: COMPONENT_VERSIONS[input.platform],
    },
    { label: 'UI library', value: COMPONENT_VERSIONS.ui },
    {
      label: 'Backend',
      value: backend ? backend.version : backend === null ? 'Offline' : 'Checking…',
    },
    { label: 'API version', value: backend ? String(backend.apiVersion) : '—' },
    { label: 'Schema version', value: backend ? String(backend.schemaVersion) : '—' },
  ];
  if (input.platform === 'mobile')
    rows.push({
      label: 'Build',
      value: `${BUILD_NUMBERS.android} (Android) · ${BUILD_NUMBERS.ios} (iOS)`,
    });
  if (input.commit) rows.push({ label: 'Commit', value: input.commit });
  if (input.environment) rows.push({ label: 'Environment', value: input.environment });
  return rows;
}

/** Plain text for "Copy diagnostics". */
export function diagnosticsText(rows: readonly VersionRow[]): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

/**
 * Whether this client is older than the backend supports. `null` while the backend is
 * unknown (loading or offline): never block on missing information.
 */
export function updateRequired(
  platform: 'web' | 'mobile',
  backend: LiveBackendInfo | null | undefined,
): boolean | null {
  if (!backend) return null;
  const minimum = platform === 'web' ? backend.minimumWebVersion : backend.minimumMobileVersion;
  return compareVersions(COMPONENT_VERSIONS[platform], minimum) < 0;
}
