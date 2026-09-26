'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@convex/_generated/api';
import { Button, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';

export function SignInForm({ initialIdentifier }: { initialIdentifier: string }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
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
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Your money, back in focus."
      description="Sign in to continue with your private financial picture."
      footer={
        <span>
          New to Finapp? <Link href="/sign-up">Create an account</Link>
        </span>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="auth-field">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com or @you"
            value={identifier}
            onChangeText={setIdentifier}
            error={Boolean(error)}
            required
          />
        </div>
        <div className="auth-field">
          <div className="auth-label-row">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            error={Boolean(error)}
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
          disabled={pending || !identifier.trim() || !password}
          aria-busy={pending}
        >
          {pending ? 'Sending your code…' : 'Continue with email'}
        </Button>
        <p className="auth-form-note">We’ll confirm it’s you with a one-time email code.</p>
      </form>
    </AuthFrame>
  );
}
