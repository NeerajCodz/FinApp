import { getOptionalUser, requireUser } from '../shared/auth';

type UserQueryContext = Parameters<typeof requireUser>[0];

export async function currentProfile(ctx: UserQueryContext) {
  return getOptionalUser(ctx);
}

export async function currentUser(ctx: UserQueryContext) {
  return requireUser(ctx);
}
