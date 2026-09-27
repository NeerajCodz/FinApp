'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@convex/_generated/api';
import { ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@finapp/ui/web';

export default function SignInPage() {
  const [identifier, setIdentifier] = React.useState('');
  React.useEffect(() => {
    setIdentifier(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !identifier.trim() || !password) return;
    setPending(true);
    setError('');
    try {
      const result = await requestEmailTwoFactor({ identifier: identifier.trim(), password });
      if (result.status === 'verification-required') {
        const form = new FormData();
        form.set('email', result.email);
        form.set('password', password);
        form.set('flow', 'verification-required');
        await signIn('password', form);
        router.replace(`/verify?email=${encodeURIComponent(result.email)}&next=dashboard`);
      } else if (result.status === 'two-factor-disabled') {
        const form = new FormData();
        form.set('email', identifier.trim());
        form.set('password', password);
        form.set('flow', 'signIn');
        const signInResult = await signIn('password', form);
        if (!signInResult.signingIn) throw new Error('Unable to sign in. Try again.');
        router.replace('/dashboard');
      } else {
        router.replace(`/two-factor?challengeId=${encodeURIComponent(result.challengeId)}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Try again.');
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
          <Link href="/welcome" className="auth-home-link">
            Back
          </Link>
        </div>
        <div className="auth-card">
          <span className="auth-eyebrow">WELCOME BACK</span>
          <h1 id="auth-title">Welcome back.</h1>
          <p className="auth-description">Your money, back in focus.</p>
          <div className="auth-form">
            <form onSubmit={submit} noValidate className="auth-form">
              <div className="auth-field">
                <Label htmlFor="identifier">Email or username</Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="you@example.com or @neeraj"
                  value={identifier}
                  onChangeText={setIdentifier}
                  error={!!error}
                  required
                />
              </div>
              <div className="auth-field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChangeText={setPassword}
                  error={!!error}
                  required
                />
              </div>
              {error && (
                <p className="auth-error" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
              <Link
                className="auth-back-link"
                href={`/forgot-password${identifier.includes('@') ? `?email=${encodeURIComponent(identifier.trim().toLowerCase())}` : ''}`}
              >
                Forgot password?
              </Link>
              <Button
                type="submit"
                size="lg"
                disabled={pending || !identifier.trim() || !password}
                aria-busy={pending}
              >
                {pending ? 'Please wait…' : 'Sign in'} <ArrowRight size={16} />
              </Button>
              <div className="auth-footer">
                New to Finapp? <Link href="/sign-up">Create account</Link>
              </div>
            </form>
          </div>
        </div>
        <span className="auth-legal">
          Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
        </span>
      </section>
    </main>
  );
}
