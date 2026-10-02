import { describe, expect, it } from 'vitest';
import {
  groupInvitationPath,
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
});
