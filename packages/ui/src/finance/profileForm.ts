/** Draft, validation and diffing for the profile editor (shared by web and native). */
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  normalizePhone,
  normalizeUsername,
  usernameProblem,
  usernameProblemText,
  type ProfileUpdate,
} from '@convex/users/domain';

export { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH };

export type AvatarGender = 'neutral' | 'male' | 'female';

export type ProfileAvatarDraft =
  | { kind: 'preset'; avatarId: string; gender: AvatarGender }
  /** The photo already on the account. */
  | { kind: 'photo'; url: string }
  /** A photo picked in this session, uploaded on save. `file` is platform data (File / uri). */
  | { kind: 'newPhoto'; previewUrl: string; file: unknown }
  | { kind: 'none' };

export type ProfileDraft = {
  displayName: string;
  username: string;
  bio: string;
  phone: string;
  timezone: string;
  avatar: ProfileAvatarDraft;
};

export type ProfileSource = {
  displayName?: string;
  name?: string;
  username?: string;
  bio?: string;
  phone?: string;
  timezone?: string;
  avatarId?: string;
  gender?: AvatarGender;
  avatarUrl?: string | null;
};

export function profileDraftFrom(profile: ProfileSource, fallbackTimezone = ''): ProfileDraft {
  return {
    displayName: profile.displayName ?? profile.name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    phone: profile.phone ?? '',
    timezone: profile.timezone ?? fallbackTimezone,
    avatar: profile.avatarId
      ? { kind: 'preset', avatarId: profile.avatarId, gender: profile.gender ?? 'neutral' }
      : profile.avatarUrl
        ? { kind: 'photo', url: profile.avatarUrl }
        : { kind: 'none' },
  };
}

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'current' | 'taken' | 'offline';

export type ProfileField = 'displayName' | 'username' | 'bio' | 'phone' | 'timezone';
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export function phoneProblem(value: string): string | null {
  if (!value.trim()) return null;
  return /^\+?[1-9]\d{7,14}$/.test(normalizePhone(value))
    ? null
    : 'Use an international number, e.g. +44 7700 900123.';
}

export function isValidTimezone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function validateProfileDraft(
  draft: ProfileDraft,
  usernameStatus: UsernameStatus = 'idle',
): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = draft.displayName.trim();
  if (!name) errors.displayName = 'Add the name people see.';
  else if (name.length > DISPLAY_NAME_MAX_LENGTH)
    errors.displayName = `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  const problem = usernameProblem(draft.username);
  if (problem) errors.username = usernameProblemText(problem);
  else if (usernameStatus === 'taken') errors.username = 'That username is taken.';
  if (draft.bio.trim().length > BIO_MAX_LENGTH)
    errors.bio = `Use at most ${BIO_MAX_LENGTH} characters.`;
  const phone = phoneProblem(draft.phone);
  if (phone) errors.phone = phone;
  if (draft.timezone && !isValidTimezone(draft.timezone)) errors.timezone = 'Choose a time zone.';
  return errors;
}

export type AvatarChange =
  | { kind: 'preset'; avatarId: string; gender: AvatarGender }
  | { kind: 'upload'; file: unknown }
  | { kind: 'remove' };

export type ProfileChanges = {
  /** Fields saved through the offline-capable profile write (`user.update`). */
  identity: ProfileUpdate;
  /** Normalized new username (needs a live connection). */
  username?: string;
  avatar?: AvatarChange;
  dirty: boolean;
};

function sameAvatar(left: ProfileAvatarDraft, right: ProfileAvatarDraft): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'preset' && right.kind === 'preset') return left.avatarId === right.avatarId;
  if (left.kind === 'newPhoto' && right.kind === 'newPhoto') return left.file === right.file;
  return true;
}

/** What changed between the saved profile and the draft. */
export function profileChanges(initial: ProfileDraft, draft: ProfileDraft): ProfileChanges {
  const identity: ProfileUpdate = {};
  const name = draft.displayName.trim();
  if (name !== initial.displayName.trim()) identity.displayName = name;
  const bio = draft.bio.trim().replace(/\s+/g, ' ');
  if (bio !== initial.bio.trim()) identity.bio = bio;
  const phone = draft.phone.trim();
  if (normalizePhone(phone) !== normalizePhone(initial.phone)) identity.phone = phone;
  if (draft.timezone && draft.timezone !== initial.timezone) identity.timezone = draft.timezone;
  const username = normalizeUsername(draft.username);
  const changes: ProfileChanges = {
    identity,
    ...(username !== normalizeUsername(initial.username) ? { username } : {}),
    dirty: false,
  };
  if (!sameAvatar(initial.avatar, draft.avatar)) {
    if (draft.avatar.kind === 'preset')
      changes.avatar = {
        kind: 'preset',
        avatarId: draft.avatar.avatarId,
        gender: draft.avatar.gender,
      };
    else if (draft.avatar.kind === 'newPhoto')
      changes.avatar = { kind: 'upload', file: draft.avatar.file };
    else if (draft.avatar.kind === 'none') changes.avatar = { kind: 'remove' };
  }
  changes.dirty =
    Object.keys(identity).length > 0 || changes.username !== undefined || Boolean(changes.avatar);
  return changes;
}

// ---------------------------------------------------------------------------------------------
// Time zones

const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

/** Every IANA zone the runtime knows (a curated list where `supportedValuesOf` is missing). */
export function timezoneList(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones.includes('UTC') ? zones : ['UTC', ...zones];
  } catch {
    // Fall through to the curated list.
  }
  return FALLBACK_TIMEZONES;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** "GMT+5:30" for a zone at `at` (DST-aware). */
export function timezoneOffset(zone: string, at = Date.now()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((entry) => entry.type === 'timeZoneName');
    return part?.value === 'GMT' ? 'GMT+0' : (part?.value ?? '');
  } catch {
    return '';
  }
}

/** "Kolkata · Asia" style label parts. */
export function timezoneLabel(zone: string): { city: string; region: string } {
  const parts = zone.split('/');
  const city = (parts.at(-1) ?? zone).replace(/_/g, ' ');
  const region = parts.length > 1 ? parts.slice(0, -1).join(' / ').replace(/_/g, ' ') : '';
  return { city, region };
}

/** Zones matching the query by city, region or offset ("kolkata", "asia", "+5:30"). */
export function searchTimezones(zones: readonly string[], query: string, limit = 60): string[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
  if (!needle) return zones.slice(0, limit);
  const scored: { zone: string; score: number }[] = [];
  for (const zone of zones) {
    const lower = zone.toLowerCase();
    const city = (lower.split('/').at(-1) ?? lower).replace(/_/g, ' ');
    const plain = needle.replace(/_/g, ' ');
    let score = -1;
    if (city.startsWith(plain)) score = 0;
    else if (lower.includes(needle)) score = 1;
    else if (/[+\-\d]/.test(needle) && timezoneOffset(zone).toLowerCase().includes(needle))
      score = 2;
    if (score >= 0) scored.push({ zone, score });
  }
  return scored
    .sort((left, right) => left.score - right.score || left.zone.localeCompare(right.zone))
    .slice(0, limit)
    .map((entry) => entry.zone);
}

// ---------------------------------------------------------------------------------------------
// Photos

export const AVATAR_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function avatarPhotoProblem(file: { type?: string; size?: number }): string | null {
  if (file.type && !(AVATAR_PHOTO_TYPES as readonly string[]).includes(file.type.toLowerCase()))
    return 'Choose a JPEG, PNG, WebP or GIF image.';
  if (file.size !== undefined && file.size > AVATAR_PHOTO_MAX_BYTES)
    return 'Choose an image under 5 MB.';
  return null;
}

/** Readable text for a server error code from a profile save. */
export function profileSaveErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('USERNAME_TAKEN')) return 'That username is taken.';
  if (message.includes('USERNAME_RESERVED')) return 'That username is reserved.';
  if (message.includes('INVALID_PHONE')) return 'That phone number doesn’t look right.';
  if (message.includes('INVALID_TIMEZONE')) return 'Choose a valid time zone.';
  if (message.includes('INVALID_BIO')) return `Keep your bio under ${BIO_MAX_LENGTH} characters.`;
  if (message.includes('AVATAR_TOO_LARGE')) return 'Choose an image under 5 MB.';
  if (message.includes('AVATAR_UNSUPPORTED_TYPE')) return 'Choose a JPEG, PNG, WebP or GIF image.';
  if (message.includes('EMAIL_NOT_VERIFIED'))
    return 'Verify your email before editing your profile.';
  if (message.includes('INVALID_PROFILE')) return 'Check the highlighted fields.';
  return 'Could not save your profile. Try again.';
}
