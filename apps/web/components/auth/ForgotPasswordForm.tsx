'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Input, InputOTP, Label } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';

export function ForgotPasswordForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('email', email.trim().toLowerCase());
    form.set('flow', 'reset');
    try {
      await signIn('password', form);
      setRequested(true);
      setCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a reset code.');
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || password.length < 8 || pending) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('email', email.trim().toLowerCase());
    form.set('code', code);
    form.set('newPassword', password);
    form.set('flow', 'reset-verification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset the password.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="ACCOUNT RECOVERY"
      title={requested ? 'Choose a new password.' : 'Let’s get you back in.'}
      description={
        requested
          ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
          : 'We will email you a short-lived code to reset your password.'
      }
      footer={
        <span>
          Remembered it? <Link href="/sign-in">Return to sign in</Link>
        </span>
      }
    >
      {!requested ? (
        <form onSubmit={requestCode}>
          <div className="auth-field">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              error={Boolean(error)}
              required
            />
          </div>
          {error && (
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending || !email.trim()} aria-busy={pending}>
            {pending ? 'Sending code…' : 'Send reset code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword}>
          <div className="auth-field">
            <span className="auth-label">Six-digit code</span>
            <InputOTP value={code} onChangeText={setCode} />
          </div>
          <div className="auth-field">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least eight characters"
              value={password}
              onChangeText={setPassword}
              error={Boolean(error)}
              required
            />
            <span className="auth-helper">Use at least eight characters.</span>
          </div>
          {error && (
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={pending || code.length !== 6 || password.length < 8}
            aria-busy={pending}
          >
            {pending ? 'Updating password…' : 'Update password'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onPress={() => void requestCode()}
          >
            Send a new code
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
