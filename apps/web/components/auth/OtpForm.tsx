'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, InputOTP } from '@finapp/ui/web';
import { AuthFrame } from './AuthFrame';

export function EmailVerificationForm({
  email,
  next,
}: {
  email: string;
  next: 'dashboard' | 'onboarding';
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || code.length !== 6 || !email) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('email', email);
    form.set('code', code);
    form.set('flow', 'email-verification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      router.replace(next === 'onboarding' ? '/onboarding' : '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this code.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="EMAIL CONFIRMATION"
      title="A quick check, then you’re in."
      description={`Enter the six-digit code sent to ${email || 'your email address'}. It expires in 10 minutes.`}
      footer={
        <span>
          Need another code?{' '}
          <a href={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
            Return to sign in
          </a>
        </span>
      }
    >
      <form onSubmit={submit}>
        <div className="auth-field">
          <span className="auth-label">Six-digit code</span>
          <InputOTP value={code} onChangeText={setCode} />
        </div>
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending || code.length !== 6 || !email}
          aria-busy={pending}
        >
          {pending ? 'Checking code…' : 'Verify email'}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function TwoFactorVerificationForm({ challengeId }: { challengeId: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || code.length !== 6 || !challengeId) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('challengeId', challengeId);
    form.set('code', code);
    form.set('flow', 'twoFactorVerification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this code.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="SIGN-IN CONFIRMATION"
      title="One last step."
      description="Enter the six-digit sign-in code sent to the email on your account. It expires in 10 minutes."
      footer={
        <span>
          Didn’t receive a code? <a href="/sign-in">Return to sign in</a>
        </span>
      }
    >
      <form onSubmit={submit}>
        <div className="auth-field">
          <span className="auth-label">Six-digit code</span>
          <InputOTP value={code} onChangeText={setCode} />
        </div>
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending || code.length !== 6 || !challengeId}
          aria-busy={pending}
        >
          {pending ? 'Checking code…' : 'Verify and sign in'}
        </Button>
      </form>
    </AuthFrame>
  );
}
