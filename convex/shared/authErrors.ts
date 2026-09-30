export type AuthFailureContext =
  'sign-in' | 'sign-up' | 'verification' | 'password-reset-request' | 'password-reset';

const fallbackMessages: Record<AuthFailureContext, string> = {
  'sign-in': 'We could not sign you in. Check your details and try again.',
  'sign-up': 'We could not create your account. Check your details and try again.',
  verification: 'We could not verify that code. Request a new one and try again.',
  'password-reset-request':
    'We could not send a reset code. Check the email address and try again.',
  'password-reset': 'We could not reset your password. Check the code and try again.',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAuthEmail(value: string): boolean {
  return emailPattern.test(value.trim());
}

function errorText(cause: unknown): string {
  if (typeof cause === 'string') return cause;
  if (!cause || typeof cause !== 'object') return '';
  const values: string[] = [];
  const pending: unknown[] = [cause];
  const seen = new Set<object>();
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ['message', 'data', 'code', 'error', 'reason']) {
      const nested = record[key];
      if (typeof nested === 'string') values.push(nested);
      else if (nested && typeof nested === 'object') pending.push(nested);
    }
  }
  return values.join(' ');
}

export function formatAuthError(cause: unknown, context: AuthFailureContext): string {
  const message = errorText(cause).toLowerCase();

  if (/password_too_short|invalid password|password.{0,30}(too short|at least 8)/.test(message)) {
    return context === 'password-reset'
      ? 'Your new password must be at least eight characters.'
      : 'Your password must be at least eight characters.';
  }

  if (
    context === 'sign-up' &&
    /account_exists|account.{0,50}(already exists|already registered)|email.{0,50}(already exists|already registered)|user.{0,50}(already exists|already registered)|(already exists|already registered).{0,50}(account|email|user)/.test(
      message,
    )
  ) {
    return 'An account with this email already exists. Sign in instead.';
  }

  if (
    context === 'sign-in' &&
    /invalid_credentials|invalid credentials|invalidaccountid|invalidsecret|incorrect (email|username|password)|wrong password/.test(
      message,
    )
  ) {
    return 'Email or username and password do not match.';
  }

  if (/toomanyfailedattempts|too many|rate.?limit|try again in \d+/.test(message)) {
    return 'Too many attempts. Wait a little, then try again.';
  }

  if (
    /invalid code|code.{0,30}(invalid|expired|incorrect)|could not verify (this )?code|could not be verified/.test(
      message,
    )
  ) {
    return 'That code is incorrect or expired. Request a new code and try again.';
  }

  if (/email is already verified|email_already_verified/.test(message)) {
    return 'This email is already verified. Return to sign in.';
  }

  return fallbackMessages[context];
}
