export type UserProfile = {
  identityId: string;
  displayName: string;
  username?: string;
  email: string;
  phone?: string;
  avatarStorageId?: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: number;
  updatedAt: number;
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
};

export type ProfileUpdate = Partial<
  Pick<UserProfile, 'displayName' | 'username' | 'phone' | 'defaultCurrency' | 'timezone'>
>;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, '');
}

export function validateProfileUpdate(update: ProfileUpdate): void {
  if (update.displayName !== undefined && update.displayName.trim().length === 0)
    throw new Error('INVALID_PROFILE');
  if (
    update.username !== undefined &&
    !/^[a-z0-9_]{3,32}$/i.test(normalizeUsername(update.username))
  )
    throw new Error('INVALID_PROFILE');
  if (update.phone !== undefined && !/^\+?[1-9]\d{7,14}$/.test(normalizePhone(update.phone)))
    throw new Error('INVALID_PHONE');
  if (update.defaultCurrency !== undefined && !/^[A-Z]{3}$/.test(update.defaultCurrency))
    throw new Error('INVALID_CURRENCY');
  if (update.timezone !== undefined && update.timezone.trim().length === 0)
    throw new Error('INVALID_PROFILE');
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
