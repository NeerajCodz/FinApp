'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button, Checkbox, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from '@/components/auth/AuthFrame';

export default function SignUpPage() {
  const [email, setEmail] = React.useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !email.trim() || password.length < 8) return;
    setPending(true);
    setError('');
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
      setError(cause instanceof Error ? cause.message : 'Unable to create account');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="START CLEARLY"
      title="Start clearly."
      description="Build a calmer money habit. One private ledger for spending, accounts, budgets, and shared expenses."
      footer={
        <span>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </span>
      }
    >
      <form onSubmit={submit} noValidate className="auth-form">
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
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a secure password"
            value={password}
            onChangeText={setPassword}
            error={!!error}
            required
          />
          <span className="auth-helper">Use at least eight characters.</span>
        </div>
        <div className="auth-two-factor-option">
          <Checkbox
            checked={twoFactorEnabled}
            onChange={setTwoFactorEnabled}
            label="Use email two-factor sign-in"
          />
          <p>Optional. Require a code sent to your email after your password.</p>
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
          {pending ? 'Please wait…' : 'Create account'} <ArrowRight size={16} />
        </Button>
        <Link className="auth-back-link" href="/welcome">
          <ArrowLeft size={15} /> Back
        </Link>
      </form>
    </AuthFrame>
  );
}
