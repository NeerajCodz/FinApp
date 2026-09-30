'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Checkbox, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';
import { PasswordField } from './PasswordField';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const emailInput = event.currentTarget.elements.namedItem('email');
    const errors = {
      email: !email.trim()
        ? 'Enter your email address.'
        : emailInput instanceof HTMLInputElement && emailInput.validity.typeMismatch
          ? 'Enter a valid email address.'
          : '',
      password: password.length < 8 ? 'Use at least eight characters for your password.' : '',
    };
    setFieldErrors(errors);
    setError('');
    if (errors.email || errors.password) {
      const input = event.currentTarget.elements.namedItem(errors.email ? 'email' : 'password');
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    const form = new FormData();
    form.set('email', normalizedEmail);
    form.set('password', password);
    form.set('twoFactorEnabled', twoFactorEnabled ? 'true' : 'false');
    form.set('flow', 'signUp');
    try {
      const result = await signIn('password', form);
      router.replace(
        result.signingIn
          ? '/onboarding'
          : `/verify?email=${encodeURIComponent(normalizedEmail)}&next=onboarding`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your account. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="YOUR NEXT CHAPTER"
      title="Make room for clarity."
      description="A private space for your everyday money. Start with your email and a password."
      footer={<span>Already have an account? <Link href="/sign-in">Sign in</Link></span>}
    >
      <form onSubmit={submit} noValidate aria-busy={pending} aria-describedby={error ? 'sign-up-error' : undefined}>
        <div className="auth-field">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((current) => ({ ...current, email: '' }));
              setError('');
            }}
            error={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            disabled={pending}
            required
          />
          {fieldErrors.email && <p id="email-error" className="auth-field-error" role="alert">{fieldErrors.email}</p>}
        </div>
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: '' }));
              setError('');
            }}
            minLength={8}
            error={Boolean(fieldErrors.password)}
            aria-describedby={`password-help${fieldErrors.password ? ' password-error' : ''}`}
            disabled={pending}
            required
          />
          <span id="password-help" className="auth-helper">Use at least eight characters.</span>
          {fieldErrors.password && <p id="password-error" className="auth-field-error" role="alert">{fieldErrors.password}</p>}
        </div>
        <div className="auth-two-factor-option">
          <Checkbox
            checked={twoFactorEnabled}
            onChange={setTwoFactorEnabled}
            disabled={pending}
            label="Use email two-factor sign-in"
          />
          <p>Optional. Require a code sent to your email after your password.</p>
        </div>
        {error && <p id="sign-up-error" className="auth-error" role="alert">{error}</p>}
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
          <span className="auth-button-arrow" aria-hidden="true">↗</span>
        </Button>
        <p className="auth-form-note">We’ll send a one-time code to confirm your email.</p>
      </form>
    </AuthFrame>
  );
}
