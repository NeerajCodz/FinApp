import { describe, expect, it } from 'vitest';
import {
  clearPendingGroupInvitation,
  groupInvitationPath,
  pendingGroupInvitationPath,
  rememberPendingGroupInvitation,
  unverifiedSignInVerificationUrl,
} from '../../apps/web/lib/authRoutes';

describe('unverified sign-in redirect', () => {
  it('preserves the email and sends completed verification to onboarding', () => {
    const email = 'person+new@example.com';
    const destination = new URL(unverifiedSignInVerificationUrl(email), 'https://finapp.test');

    expect(destination.pathname).toBe('/verify');
    expect(destination.searchParams.get('email')).toBe(email);
    expect(destination.searchParams.get('next')).toBe('onboarding');
  });
});

describe('public group invitation route', () => {
  it('accepts only an opaque hex token and encodes it into the local join path', () => {
    const token = 'ab'.repeat(32);

    expect(groupInvitationPath(token)).toBe(`/group/invite?token=${token}`);
    expect(groupInvitationPath(`${token}https://attacker.example`)).toBeNull();
  });

  it('retains a valid invitation until it is explicitly cleared', () => {
    const token = 'cd'.repeat(32);
    const values = new Map<string, string>();
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          setItem: (key: string, value: string) => values.set(key, value),
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => values.delete(key),
        },
      },
    });
    try {
      expect(rememberPendingGroupInvitation(token)).toBe(true);
      expect(pendingGroupInvitationPath()).toBe(`/group/invite?token=${token}`);
      clearPendingGroupInvitation();
      expect(pendingGroupInvitationPath()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
  });
});
