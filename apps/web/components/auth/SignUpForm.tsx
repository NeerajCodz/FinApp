'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !email.trim() || password.length < 8) return;
    setPending(true);
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    const form = new FormData();
    form.set('email', normalizedEmail);
    form.set('password', password);
    form.set('flow', 'signUp');
    try {
      const result = await signIn('password', form);
      router.replace(
        result.signingIn
          ? '/onboarding'
          : `/verify?email=${encodeURIComponent(normalizedEmail)}&next=onboarding`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to create your account. Try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="A FRESH START"
      title="Start with a little more clarity."
      description="Create your account. Your financial space stays private and yours."
      footer={
        <span>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </span>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="auth-field">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={Boolean(error)}
            required
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
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
          disabled={pending || !email.trim() || password.length < 8}
          aria-busy={pending}
        >
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>
        <p className="auth-form-note">A one-time code will be sent to confirm your email.</p>
      </form>
    </AuthFrame>
  );
}
