import { requireUser } from '../shared/auth';
import { validateProfileUpdate, type UserProfile, type UserSettings } from './domain';

type UserMutationContext = Parameters<typeof requireUser>[0];

type ProfileUpdate = Partial<
  Pick<UserProfile, 'displayName' | 'username' | 'defaultCurrency' | 'timezone'>
>;

export async function updateProfile(ctx: UserMutationContext, update: ProfileUpdate) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  validateProfileUpdate(update);
  await ctx.db.patch(user._id, { ...update, updatedAt: Date.now() });
  return { ...user, ...update, updatedAt: Date.now() };
}

export async function updateSettings(ctx: UserMutationContext, settings: Partial<UserSettings>) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  await ctx.db.patch(user._id, { updatedAt: Date.now() });
  return settings;
}

export async function requestAccountDeletion(ctx: UserMutationContext) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  const deletedAt = Date.now();
  await ctx.db.patch(user._id, { deletedAt, updatedAt: deletedAt });
  return { deletedAt };
}
