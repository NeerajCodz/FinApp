'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@convex/_generated/api';
import { Button, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';
import { PasswordField } from './PasswordField';

export function SignInForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ identifier: '', password: '' });
  const [pending, setPending] = useState(false);
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);
  const { signIn } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    setIdentifier(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const errors = {
      identifier: identifier.trim() ? '' : 'Enter your email or username.',
      password: password ? '' : 'Enter your password.',
    };
    setFieldErrors(errors);
    setError('');
    if (errors.identifier || errors.password) {
      const input = event.currentTarget.elements.namedItem(
        errors.identifier ? 'identifier' : 'password',
      );
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setPending(true);
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
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Back in focus."
      description="Sign in to your money, your plans, and the people you share them with."
      footer={
        <span>
          New to Finapp? <Link href="/sign-up">Create an account</Link>
        </span>
      }
    >
      <form
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-describedby={error ? 'sign-in-error' : undefined}
      >
        <div className="auth-field">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@example.com or @you"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              setFieldErrors((current) => ({ ...current, identifier: '' }));
              setError('');
            }}
            error={Boolean(fieldErrors.identifier)}
            aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
            disabled={pending}
            required
          />
          {fieldErrors.identifier && (
            <p id="identifier-error" className="auth-field-error" role="alert">
              {fieldErrors.identifier}
            </p>
          )}
        </div>
        <div className="auth-field">
          <div className="auth-label-row">
            <Label htmlFor="password">Password</Label>
            <Link
              href={`/forgot-password${identifier.includes('@') ? `?email=${encodeURIComponent(identifier.trim().toLowerCase())}` : ''}`}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: '' }));
              setError('');
            }}
            error={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            disabled={pending}
            required
          />
          {fieldErrors.password && (
            <p id="password-error" className="auth-field-error" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>
        {error && (
          <p id="sign-in-error" className="auth-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? 'Signing you in…' : 'Sign in'}
          <span className="auth-button-arrow" aria-hidden="true">
            ↗
          </span>
        </Button>
        <p className="auth-form-note">
          If you use email two-factor sign-in, we’ll ask for your code next.
        </p>
      </form>
    </AuthFrame>
  );
}
