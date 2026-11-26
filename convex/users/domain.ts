import { avatarGenderForId, avatarGenders, type AvatarGender } from '../avatars/domain';
export type AccentValue = 'volt' | 'white' | 'blue' | `#${string}`;

export type UserProfile = {
  identityId: string;
  displayName: string;
  username?: string;
  bio?: string;
  accent?: AccentValue;
  email: string;
  phone?: string;
  avatarStorageId?: string;
  avatarId?: string;
  gender?: AvatarGender;
  defaultCurrency: string;
  timezone: string;
  createdAt: number;
  updatedAt: number;
  phoneVerificationTime?: number;
  deletedAt?: number;
};

export type UserSettings = {
  currency: string;
  timezone: string;
  firstDayOfWeek: number;
  financialMonthStart: number;
  language: string;
  appearance: 'system' | 'light' | 'dark';
  notificationPreferences: Record<string, boolean>;
  appLockPreferences: { enabled: boolean; fallback: 'device-pin' | 'disabled' };
  showActive?: boolean;
  showLastSeen?: boolean;
};

export type ProfileUpdate = Partial<
  Pick<
    UserProfile,
    | 'displayName'
    | 'username'
    | 'bio'
    | 'phone'
    | 'defaultCurrency'
    | 'timezone'
    | 'accent'
    | 'avatarId'
    | 'gender'
  >
>;

export const BIO_MAX_LENGTH = 160;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

/** Words that would read as an official or system account; never available as usernames. */
export const RESERVED_USERNAMES: readonly string[] = [
  'admin',
  'administrator',
  'finapp',
  'finai',
  'help',
  'me',
  'moderator',
  'root',
  'security',
  'settings',
  'support',
  'system',
];

export type UsernameProblem = 'empty' | 'short' | 'long' | 'characters' | 'reserved';

/** Client and server rules for a username; `null` when it is acceptable. */
export function usernameProblem(value: string): UsernameProblem | null {
  const username = normalizeUsername(value);
  if (!username) return 'empty';
  if (!/^[a-z0-9_]*$/.test(username)) return 'characters';
  if (username.length < 3) return 'short';
  if (username.length > 32) return 'long';
  if (RESERVED_USERNAMES.includes(username)) return 'reserved';
  return null;
}

export function usernameProblemText(problem: UsernameProblem): string {
  switch (problem) {
    case 'empty':
      return 'Choose a username.';
    case 'short':
      return 'Use at least 3 characters.';
    case 'long':
      return 'Use at most 32 characters.';
    case 'characters':
      return 'Use only letters, numbers and underscores.';
    case 'reserved':
      return 'That username is reserved.';
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, '');
}

export function validateProfileUpdate(update: ProfileUpdate): void {
  if (
    update.displayName !== undefined &&
    (update.displayName.trim().length === 0 ||
      update.displayName.trim().length > DISPLAY_NAME_MAX_LENGTH)
  )
    throw new Error('INVALID_PROFILE');
  if (update.bio !== undefined && update.bio.trim().length > BIO_MAX_LENGTH)
    throw new Error('INVALID_BIO');
  if (
    update.username !== undefined &&
    !/^[a-z0-9_]{3,32}$/i.test(normalizeUsername(update.username))
  )
    throw new Error('INVALID_PROFILE');
  if (update.phone !== undefined && !/^\+?[1-9]\d{7,14}$/.test(normalizePhone(update.phone)))
    throw new Error('INVALID_PHONE');
  if (
    update.accent !== undefined &&
    !(['volt', 'white', 'blue'] as string[]).includes(update.accent) &&
    !/^#[\da-f]{6}$/i.test(update.accent)
  )
    throw new Error('INVALID_ACCENT');
  if (update.defaultCurrency !== undefined && !/^[A-Z]{3}$/.test(update.defaultCurrency))
    throw new Error('INVALID_CURRENCY');
  if (update.timezone !== undefined) {
    if (update.timezone.trim().length === 0) throw new Error('INVALID_PROFILE');
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: update.timezone }).format(0);
    } catch {
      throw new Error('INVALID_TIMEZONE');
    }
  }
  if (update.avatarId !== undefined && !avatarGenderForId(update.avatarId))
    throw new Error('INVALID_AVATAR');
  if (update.gender !== undefined && !avatarGenders.includes(update.gender))
    throw new Error('INVALID_GENDER');
  if (
    update.avatarId !== undefined &&
    update.gender !== undefined &&
    avatarGenderForId(update.avatarId) !== update.gender
  )
    throw new Error('AVATAR_GENDER_MISMATCH');
}

export function canCompleteOnboarding(
  settings: Pick<UserSettings, 'currency'>,
  firstAccountName?: string,
): boolean {
  return (
    /^[A-Z]{3}$/.test(settings.currency) &&
    (!firstAccountName || firstAccountName.trim().length > 0)
  );
}
