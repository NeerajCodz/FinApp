'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react';
import { Button, InputOTP } from '@finapp/ui/web';

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [next, setNext] = React.useState<'dashboard' | 'onboarding'>('dashboard');
  const [code, setCode] = React.useState('');
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedEmail = params.get('email') ?? '';
    if (!parsedEmail) router.replace('/sign-in');
    setEmail(parsedEmail);
    setNext(params.get('next') === 'onboarding' ? 'onboarding' : 'dashboard');
  }, [router]);
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const { signIn } = useAuthActions();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
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
          <span className="auth-eyebrow">EMAIL VERIFICATION</span>
          <h1 id="auth-title">Verify your email.</h1>
          <p className="auth-description">
            {next === 'onboarding'
              ? `Enter the six-digit code sent to ${email || 'your email address'}. The code expires in 10 minutes.`
              : 'Enter the six-digit code sent to the email on your account. The code expires in 10 minutes.'}
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
                <p className="auth-helper">Sign in with your password to send a fresh code.</p>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={pending || code.length !== 6 || !email}
                aria-busy={pending}
              >
                {pending ? 'Verifying…' : 'Verify email'}
              </Button>
              <Link
                className="auth-back-link"
                href={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ''}`}
              >
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
