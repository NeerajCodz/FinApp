import { describe, expect, it } from 'vitest';
import { requireIdentity, getOptionalUser } from '../../convex/shared/auth';

describe('authentication boundaries', () => {
  it('rejects unauthenticated access with AUTH_REQUIRED', async () => {
    const ctx = { auth: { getUserIdentity: async () => null } };
    await expect(requireIdentity(ctx as never)).rejects.toThrow('AUTH_REQUIRED');
  });

  it('returns null for optional unauthenticated access', async () => {
    const ctx = { auth: { getUserIdentity: async () => null } };
    await expect(getOptionalUser(ctx as never)).resolves.toBeNull();
  });
});
