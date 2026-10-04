import { describe, expect, it } from 'vitest';
import { isValidAuthEmail, formatAuthError } from '../../convex/shared/authErrors';

describe('formatAuthError', () => {
  it('accepts only email syntax supported by authentication', () => {
    expect(isValidAuthEmail(' Person@example.com ')).toBe(true);
    expect(isValidAuthEmail('person@localhost')).toBe(false);
    expect(isValidAuthEmail('not-an-email')).toBe(false);
  });

  it('explains incorrect credentials without exposing auth internals', () => {
    expect(formatAuthError(new Error('Invalid credentials'), 'sign-in')).toBe(
      'Email or username and password do not match.',
    );
  });

  it('explains duplicate account and password-length errors', () => {
    expect(
      formatAuthError(
        new Error('Server Error: Account person@example.com already exists'),
        'sign-up',
      ),
    ).toBe('An account with this email already exists. Sign in instead.');
    expect(formatAuthError(new Error('PASSWORD_TOO_SHORT'), 'sign-up')).toBe(
      'Your password must be at least eight characters.',
    );
  });

  it('maps backend auth error codes to actionable account messages', () => {
    expect(formatAuthError({ data: { code: 'ACCOUNT_EXISTS' } }, 'sign-up')).toBe(
      'An account with this email already exists. Sign in instead.',
    );
    expect(formatAuthError({ data: { code: 'INVALID_CREDENTIALS' } }, 'sign-in')).toBe(
      'Email or username and password do not match.',
    );
  });

  it('handles code and attempt-limit failures with safe next steps', () => {
    expect(formatAuthError(new Error('Invalid code'), 'verification')).toBe(
      'That code is incorrect or expired. Request a new code and try again.',
    );
    expect(formatAuthError(new Error('Too many failed attempts'), 'sign-in')).toBe(
      'Too many attempts. Wait a little, then try again.',
    );
    expect(formatAuthError(new Error('TooManyFailedAttempts'), 'sign-in')).toBe(
      'Too many attempts. Wait a little, then try again.',
    );
  });

  it('asks users to reconnect when an auth request fails on the network', () => {
    expect(formatAuthError(new TypeError('Failed to fetch'), 'sign-in')).toBe(
      'Check your internet connection and try again.',
    );
    expect(formatAuthError(new Error('Network request failed'), 'verification')).toBe(
      'Check your internet connection and try again.',
    );
  });

  it('uses context-specific fallback copy instead of exposing unknown backend errors', () => {
    expect(formatAuthError(new Error('ConvexError: internal stack trace'), 'sign-in')).toBe(
      'We could not sign you in. Check your details and try again.',
    );
  });
});
