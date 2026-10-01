'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Input, InputOTP, Label } from '@finapp/ui/web';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  React.useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [requested, setRequested] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
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

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
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
    <main className="auth-layout">
      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-topline">
          <Link href="/" className="brand auth-brand" aria-label="Finapp home">
            <span className="brand-mark" aria-hidden="true">
              F
            </span>
            <span>finapp</span>
          </Link>
          <Link href="/sign-in" className="auth-home-link">
            Back
          </Link>
        </div>
        <div className="auth-card">
          <span className="auth-eyebrow">ACCOUNT RECOVERY</span>
          <h1 id="auth-title">{requested ? 'Choose a new password.' : 'Reset your password.'}</h1>
          <p className="auth-description">
            {requested
              ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
              : 'We will email you a short-lived code to reset your password.'}
          </p>
          <div className="auth-form">
            {!requested ? (
              <form
                method="post"
                onSubmit={(event) => void requestCode(event)}
                noValidate
                className="auth-form"
              >
                <div className="auth-field">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    error={!!error}
                    required
                  />
                </div>
                {error && (
                  <p className="auth-error" role="alert" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending || !email.trim()}
                  aria-busy={pending}
                >
                  {pending ? 'Please wait…' : 'Send reset code'}
                </Button>
              </form>
            ) : (
              <form method="post" onSubmit={resetPassword} noValidate className="auth-form">
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
                    error={!!error}
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
                  {pending ? 'Please wait…' : 'Update password'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => void requestCode()}
                >
                  {pending ? 'Sending…' : 'Send a new code'}
                </Button>
              </form>
            )}
            <div className="auth-footer">
              Remembered it? <Link href="/sign-in">Return to sign in</Link>
            </div>
          </div>
        </div>
        <span className="auth-legal">
          Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
        </span>
      </section>
    </main>
  );
}
