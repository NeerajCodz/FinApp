/**
 * Version information shown on the About screens and copied as support diagnostics. Bundled
 * versions come from version.json (through convex/shared/version.ts); the backend's live
 * values come from `api.system.info`.
 */
import { Platform } from 'react-native';
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
  nativePlatform?: 'android' | 'ios';
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
  if (input.platform === 'mobile') {
    const nativePlatform = input.nativePlatform ?? Platform.OS;
    const platform = nativePlatform === 'ios' ? 'ios' : 'android';
    rows.push({
      label: 'Build',
      value: `${BUILD_NUMBERS[platform]} (${platform === 'ios' ? 'iOS' : 'Android'})`,
    });
  }
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

/** Where this client stands against the deployed backend, for the About screen. */
export type UpdateState =
  | { kind: 'checking' }
  | { kind: 'offline' }
  | { kind: 'current' }
  /** A newer release is deployed; this client still works. */
  | { kind: 'newer'; latest: string }
  /** This client is older than the backend supports. */
  | { kind: 'required'; latest: string };

export function updateState(
  platform: 'web' | 'mobile',
  backend: LiveBackendInfo | null | undefined,
): UpdateState {
  if (backend === undefined) return { kind: 'checking' };
  if (backend === null) return { kind: 'offline' };
  if (updateRequired(platform, backend))
    return { kind: 'required', latest: backend.productVersion };
  if (compareVersions(backend.productVersion, PRODUCT_VERSION) > 0)
    return { kind: 'newer', latest: backend.productVersion };
  return { kind: 'current' };
}

export const RELEASES_URL = 'https://github.com/NeerajCodz/FinApp/releases';
export const ISSUES_URL = 'https://github.com/NeerajCodz/FinApp/issues';
export const SOURCE_URL = 'https://github.com/NeerajCodz/FinApp';
export const DEVELOPER_URL = 'https://github.com/NeerajCodz';

/** GitHub release page for a product version. */
export function releaseUrl(version: string): string {
  return `${RELEASES_URL}/tag/finapp-v${version}`;
}

export type ReleaseNotes = {
  version: string;
  summary: string;
  highlights: readonly { title: string; detail: string }[];
};

/**
 * Highlights of recent releases, condensed from CHANGELOG.md (newest first). Add the new
 * release here when CHANGELOG.md gains a section.
 */
export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: '1.11.0',
    summary: 'Budgets fold into categories, new charts and a new notifications inbox.',
    highlights: [
      {
        title: 'Category limits',
        detail: 'A category’s monthly limit is its budget, with an alert level you choose.',
      },
      {
        title: 'New charts',
        detail: 'Real amounts, tap or hover for details, on web and mobile.',
      },
      {
        title: 'Notifications inbox',
        detail: 'Grouped by day, with filters and actions right in the list.',
      },
      {
        title: 'Profile and About',
        detail: 'Upload a photo, add a bio, and see what’s new in each version.',
      },
      {
        title: 'Lock after',
        detail: 'Choose how long Finapp can be away before it locks (default 5 minutes).',
      },
    ],
  },
  {
    version: '1.10.1',
    summary: 'A new lock screen, authenticator apps and recovery codes, and smoother sign-in.',
    highlights: [
      {
        title: 'Lock screen',
        detail: 'Your photo, name and a six-digit PIN that unlocks as you type, in your accent.',
      },
      {
        title: 'Authenticator apps',
        detail: 'Use Google Authenticator, 1Password, Authy or any TOTP app for sign-in codes.',
      },
      {
        title: 'Recovery codes',
        detail: 'Ten single-use codes to get back in if you lose your phone.',
      },
      {
        title: 'Smoother sign-in',
        detail: 'Straight to your dashboard after two-factor, with app, email or recovery codes.',
      },
      {
        title: 'Security alerts',
        detail: 'Get notified when an authenticator app or recovery code is used or changed.',
      },
    ],
  },
  {
    version: '1.10.0',
    summary: 'Trash for everything, a FinAI that can do everything, and redesigned settings.',
    highlights: [
      { title: 'Trash', detail: 'Deleted items can be restored until Trash empties itself.' },
      { title: 'FinAI', detail: 'Edits, creates and deletes anything, with live replies.' },
      { title: 'Attachments', detail: 'Send receipts, PDFs and spreadsheets to FinAI.' },
      { title: 'Security', detail: 'See and sign out every device on your account.' },
    ],
  },
];

/** Notes for `version`, or the newest notes when that release has none yet. */
export function releaseNotesFor(version: string = PRODUCT_VERSION): ReleaseNotes | undefined {
  return RELEASE_NOTES.find((notes) => notes.version === version) ?? RELEASE_NOTES[0];
}

/** Open-source projects Finapp is built on, for the credits list. */
export const OPEN_SOURCE_CREDITS: readonly { name: string; license: string; url: string }[] = [
  { name: 'Convex', license: 'Apache-2.0', url: 'https://github.com/get-convex/convex-js' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Next.js', license: 'MIT', url: 'https://github.com/vercel/next.js' },
  { name: 'Expo', license: 'MIT', url: 'https://github.com/expo/expo' },
  { name: 'React Native', license: 'MIT', url: 'https://github.com/facebook/react-native' },
  { name: 'Lucide icons', license: 'ISC', url: 'https://github.com/lucide-icons/lucide' },
  {
    name: 'Space Grotesk',
    license: 'OFL-1.1',
    url: 'https://github.com/floriankarsten/space-grotesk',
  },
  { name: 'Manrope', license: 'OFL-1.1', url: 'https://github.com/sharanda/manrope' },
];
