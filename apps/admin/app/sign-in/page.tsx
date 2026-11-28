'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useConvexAuth } from 'convex/react';
import { ShieldCheck } from 'lucide-react';
import { Button, Input, Label } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { formatAuthError } from '@convex/shared/authErrors';

type Challenge = {
  challengeId: string;
  methods: { totp: boolean; email: boolean; recovery: boolean };
  method: 'totp' | 'email' | 'recovery';
};

/**
 * Staff sign in with their FinApp account (same Convex Auth). Accounts with two-factor sign-in
 * go through the same second step as the apps.
 */
export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);
  const sendEmailCode = useAction(api.auth.sendTwoFactorEmailCode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (isAuthenticated && !pending) {
    router.replace('/');
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!identifier.trim() || !password) {
      setError('Enter your Finapp email or username and password.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await requestEmailTwoFactor({ identifier: identifier.trim(), password });
      if (result.status === 'verification-required') {
        setError('Verify your email in the Finapp app before signing in here.');
      } else if (result.status === 'two-factor-disabled') {
        const form = new FormData();
        form.set('email', identifier.trim());
        form.set('password', password);
        form.set('flow', 'signIn');
        const signed = await signIn('password', form);
        if (!signed.signingIn) throw new Error('Unable to sign in.');
        router.replace('/');
      } else {
        setChallenge({
          challengeId: result.challengeId,
          methods: result.methods,
          method: result.preferred,
        });
      }
    } catch (cause) {
      setError(formatAuthError(cause, 'sign-in'));
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || pending) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('challengeId', challenge.challengeId);
    form.set('code', code.trim());
    form.set('method', challenge.method);
    form.set('flow', 'twoFactorVerification');
    try {
      const signed = await signIn('password', form);
      if (!signed.signingIn) throw new Error('code');
      router.replace('/');
    } catch (cause) {
      const message = formatAuthError(cause, 'verification');
      setError(
        /suspended/i.test(message) ? message : 'That code didn’t work. Check it and try again.',
      );
      setCode('');
    } finally {
      setPending(false);
    }
  }

  async function useEmail() {
    if (!challenge) return;
    setError('');
    try {
      await sendEmailCode({ challengeId: challenge.challengeId });
      setChallenge({ ...challenge, method: 'email' });
    } catch (cause) {
      setError(formatAuthError(cause, 'verification'));
    }
  }

  return (
    <main className="admin-auth">
      <section className="admin-auth-card" aria-labelledby="sign-in-title">
        <div className="admin-brand">
          <ShieldCheck size={26} aria-hidden />
          Finapp <span>Admin</span>
        </div>
        <h1 id="sign-in-title" style={{ fontSize: 24 }}>
          {challenge ? 'Two-factor check' : 'Staff sign in'}
        </h1>
        {!challenge ? (
          <>
            <p>Use your Finapp account. Only staff can open the console.</p>
            <form className="admin-form" onSubmit={submitPassword} noValidate>
              <div className="admin-field">
                <Label htmlFor="identifier">Email or username</Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChangeText={setIdentifier}
                />
              </div>
              <div className="admin-field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChangeText={setPassword}
                />
              </div>
              {error ? (
                <p className="admin-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p>
              {challenge.method === 'totp'
                ? 'Enter the 6-digit code from your authenticator app.'
                : challenge.method === 'email'
                  ? 'Enter the 6-digit code we emailed you.'
                  : 'Enter one of your recovery codes.'}
            </p>
            <form className="admin-form" onSubmit={submitCode} noValidate>
              <Input
                aria-label="Verification code"
                autoComplete="one-time-code"
                inputMode={challenge.method === 'recovery' ? 'text' : 'numeric'}
                value={code}
                onChangeText={setCode}
              />
              {error ? (
                <p className="admin-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending || code.trim().length < 6}>
                {pending ? 'Checking…' : 'Verify'}
              </Button>
            </form>
            <div className="admin-actions">
              {challenge.method !== 'email' && challenge.methods.email ? (
                <Button variant="ghost" size="sm" onPress={useEmail}>
                  Email me a code
                </Button>
              ) : null}
              {challenge.method !== 'totp' && challenge.methods.totp ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setChallenge({ ...challenge, method: 'totp' })}
                >
                  Use authenticator app
                </Button>
              ) : null}
              {challenge.method !== 'recovery' && challenge.methods.recovery ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setChallenge({ ...challenge, method: 'recovery' })}
                >
                  Use a recovery code
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
