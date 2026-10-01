'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react';
import { Button, InputOTP } from '@finapp/ui/web';
import { pendingGroupInvitationPath } from '@/lib/authRoutes';

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
      router.replace(pendingGroupInvitationPath() ?? '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this code.');
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
          <span className="auth-eyebrow">SIGN-IN VERIFICATION</span>
          <h1 id="auth-title">One last step.</h1>
          <p className="auth-description">
            Enter the six-digit sign-in code sent to the email on your account. It expires in 10
            minutes.
          </p>
          <div className="auth-form">
            <form method="post" onSubmit={submit} noValidate className="auth-form">
              <div className="auth-field">
                <span className="auth-label">Six-digit code</span>
                <InputOTP value={code} onChangeText={setCode} />
              </div>
              {error && (
                <p className="auth-error" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
              <div className="auth-field">
                <span className="auth-label">Didn’t get a code?</span>
                <p className="auth-helper">Return to sign in and request another code.</p>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={pending || code.length !== 6 || !challengeId}
                aria-busy={pending}
              >
                {pending ? 'Verifying…' : 'Verify and sign in'}
              </Button>
              <Link className="auth-back-link" href="/sign-in">
                <ArrowLeft size={15} /> Return to sign in
              </Link>
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
