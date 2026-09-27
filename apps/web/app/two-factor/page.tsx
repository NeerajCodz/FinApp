'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react';
import { Button, InputOTP } from '@finapp/ui/web';
import { AuthFrame } from '@/components/auth/AuthFrame';

export default function TwoFactorPage() {
  const router = useRouter();
  const [challengeId, setChallengeId] = React.useState('');
  const [code, setCode] = React.useState('');
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('challengeId') ?? '';
    if (!id) router.replace('/sign-in');
    setChallengeId(id);
  }, [router]);
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const { signIn } = useAuthActions();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
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
      eyebrow="SIGN-IN VERIFICATION"
      title="One last step."
      description="Enter the six-digit sign-in code sent to the email on your account. It expires in 10 minutes."
      footer={<span />}
    >
      <form onSubmit={submit} noValidate className="auth-form">
        <div className="auth-field">
          <span className="auth-label">Six-digit code</span>
          <InputOTP value={code} onChangeText={setCode} />
        </div>
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <p className="auth-helper">
          Didn’t get a code? Return to sign in and request another code.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending || code.length !== 6 || !challengeId}
          aria-busy={pending}
        >
          {pending ? 'Verifying…' : 'Verify and sign in'}
        </Button>
        <a className="auth-back-link" href="/sign-in">
          <ArrowLeft size={15} /> Return to sign in
        </a>
      </form>
    </AuthFrame>
  );
}
