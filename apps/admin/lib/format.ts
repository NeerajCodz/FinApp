import { ConvexError } from 'convex/values';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return (compact && Math.abs(value) >= 10_000 ? compactFormat : numberFormat).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDate(value: number | null | undefined, withTime = false): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatDay(value: number): string {
  return new Date(value).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function timeAgo(value: number | null | undefined): string {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - value) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d ago`;
  return formatDate(value);
}

const ERROR_TEXT: Record<string, string> = {
  ADMIN_FORBIDDEN: 'You don’t have permission to do that.',
  ADMIN_MFA_REQUIRED: 'Turn on two-factor sign-in in Finapp to use the console.',
  ADMIN_ROLE_HIERARCHY: 'That’s at or above your highest role.',
  ADMIN_PERMISSION_NOT_GRANTABLE: 'You can only grant permissions you have yourself.',
  ADMIN_OWNER_PROTECTED: 'Owners can’t be changed by other staff.',
  ADMIN_LAST_OWNER: 'There must always be at least one owner.',
  ADMIN_USER_NOT_FOUND: 'No Finapp user with that username.',
  ADMIN_ROLE_NOT_FOUND: 'That role no longer exists.',
  ADMIN_ROLE_NAME_INVALID: 'Role names are 1–32 characters.',
  ADMIN_ROLE_COLOR_INVALID: 'Pick a color like #3e63dd.',
  ADMIN_ROLE_ORDER_INVALID: 'The role order changed. Try again.',
  ADMIN_CANNOT_TARGET_SELF: 'You can’t do that to your own account.',
  ADMIN_REASON_INVALID: 'Add a reason (up to 1,000 characters).',
  ADMIN_DURATION_INVALID: 'Pick a suspension length.',
  ADMIN_NOTE_INVALID: 'Notes are 1–4,000 characters.',
  ADMIN_DATA_KEY_NOT_CONFIGURED: 'Encryption isn’t configured on the server (ADMIN_DATA_KEY).',
  SUPPORT_TEXT_INVALID: 'Write a message first.',
  SUPPORT_ASSIGNEE_NOT_STAFF: 'Only staff can be assigned.',
  REPORT_ALREADY_HANDLED: 'Someone already handled this report.',
  REPORT_NO_USER: 'This report has no user to act on.',
  AI_NOT_CONFIGURED: 'AI isn’t configured on the server.',
};

export function errorText(cause: unknown): string {
  if (cause instanceof ConvexError) {
    const data = cause.data as { code?: string } | string;
    const code = typeof data === 'string' ? data : data?.code;
    if (code && ERROR_TEXT[code]) return ERROR_TEXT[code]!;
    if (code) return code;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  const known = Object.keys(ERROR_TEXT).find((code) => message.includes(code));
  return known ? ERROR_TEXT[known]! : 'Something went wrong. Try again.';
}
