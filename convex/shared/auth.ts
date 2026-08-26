type Identity = { subject: string; email?: string; name?: string; image?: string };
type UserRecord = {
  _id: string;
  identityId: string;
  email: string;
  displayName: string;
  updatedAt: number;
};
type QueryBuilder = { eq: (field: string, value: unknown) => unknown };
type UserDatabase = {
  query: (table: 'users') => {
    withIndex: (
      index: 'by_identityId',
      callback: (query: QueryBuilder) => unknown,
    ) => { unique: () => Promise<UserRecord | null> };
  };
  patch: (id: string, value: Record<string, unknown>) => Promise<void>;
  insert: (table: 'users' | 'userSettings', value: Record<string, unknown>) => Promise<string>;
  get: (id: string) => Promise<UserRecord | null>;
};
type AuthIdentityContext = { auth: { getUserIdentity: () => Promise<unknown> } };
type AuthContext = AuthIdentityContext & { db?: UserDatabase };

function asIdentity(value: unknown): Identity | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('subject' in value) ||
    typeof value.subject !== 'string'
  )
    return null;
  const record = value as Record<string, unknown>;
  return {
    subject: value.subject,
    email: typeof record.email === 'string' ? record.email : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    image: typeof record.image === 'string' ? record.image : undefined,
  };
}

export async function requireIdentity(ctx: AuthIdentityContext): Promise<Identity> {
  const identity = asIdentity(await ctx.auth.getUserIdentity());
  if (!identity) throw new Error('AUTH_REQUIRED');
  return identity;
}

export async function getOptionalUser(ctx: AuthContext): Promise<UserRecord | null> {
  const identity = asIdentity(await ctx.auth.getUserIdentity());
  if (!identity || !ctx.db) return null;
  return ctx.db
    .query('users')
    .withIndex('by_identityId', (query) => query.eq('identityId', identity.subject))
    .unique();
}

export async function requireUser(
  ctx: AuthContext & { db: UserDatabase },
): Promise<UserRecord | null> {
  const identity = await requireIdentity(ctx);
  const existing = await ctx.db
    .query('users')
    .withIndex('by_identityId', (query) => query.eq('identityId', identity.subject))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      email: identity.email ?? existing.email,
      updatedAt: Date.now(),
    });
    return { ...existing, email: identity.email ?? existing.email };
  }
  const now = Date.now();
  const userId = await ctx.db.insert('users', {
    identityId: identity.subject,
    displayName: identity.name ?? 'Finapp user',
    email: identity.email ?? '',
    defaultCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert('userSettings', {
    userId,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    firstDayOfWeek: 1,
    financialMonthStart: 1,
    language: 'en',
    appearance: 'system',
    notificationPreferences: {},
    appLockPreferences: { enabled: false, fallback: 'device-pin' },
    updatedAt: now,
  });
  return ctx.db.get(userId);
}
