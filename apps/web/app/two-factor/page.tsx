'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@convex/_generated/api';
import { formatAuthError } from '@convex/shared/authErrors';
import { ArrowLeft, KeyRound, Mail, Smartphone } from 'lucide-react';
import { Button, Input, InputOTP } from '@finapp/ui/web';
import { pendingGroupInvitationPath } from '@/lib/authRoutes';

type Method = 'totp' | 'email' | 'recovery';

const COPY: Record<Method, { label: string; title: string; description: string }> = {
  totp: {
    label: 'Authenticator app',
    title: 'Enter your app code.',
    description:
      'Open your authenticator app (Google Authenticator, 1Password, Authy…) and enter the six-digit code for Finapp.',
  },
  email: {
    label: 'Email code',
    title: 'Enter your email code.',
    description: 'Enter the six-digit code from your email. Request a new one if needed.',
  },
  recovery: {
    label: 'Recovery code',
    title: 'Use a recovery code.',
    description:
      'Enter one of the recovery codes you saved when you set up two-factor sign-in. Each code works once.',
  },
};

const ICONS: Record<Method, React.ReactNode> = {
  totp: <Smartphone size={16} aria-hidden />,
  email: <Mail size={16} aria-hidden />,
  recovery: <KeyRound size={16} aria-hidden />,
};

export default function TwoFactorPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const sendEmailCode = useAction(api.auth.sendTwoFactorEmailCode);
  const [challengeId, setChallengeId] = React.useState('');
  const [nextPath, setNextPath] = React.useState<string | null>(null);
  const [methods, setMethods] = React.useState<Method[]>(['email']);
  const [method, setMethod] = React.useState<Method>('email');
  const [emailSent, setEmailSent] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('challengeId') ?? '';
    if (!id) {
      router.replace('/sign-in');
      return;
    }
    const listed = (params.get('m') ?? 'email')
      .split(',')
      .filter(
        (value): value is Method => value === 'totp' || value === 'email' || value === 'recovery',
      );
    const available: Method[] = listed.length ? listed : ['email'];
    const requestedPreferred = params.get('p');
    const preferred =
      (requestedPreferred === 'totp' ||
        requestedPreferred === 'email' ||
        requestedPreferred === 'recovery') &&
      available.includes(requestedPreferred)
        ? requestedPreferred
        : available.includes('email')
          ? 'email'
          : available[0]!;
    const emailUnavailable = params.get('emailUnavailable') === 'true';
    setChallengeId(id);
    setMethods(available);
    setMethod(preferred);
    setEmailSent(preferred === 'email' && !emailUnavailable);
    setNotice(
      emailUnavailable
        ? 'We could not send an email code. Use your authenticator app or a recovery code, or choose Email to retry.'
        : '',
    );
    const next = params.get('next');
    setNextPath(next?.startsWith('/mcp/') && !next.startsWith('//') ? next : null);
  }, [router]);

  function choose(next: Method) {
    setMethod(next);
    setCode('');
    setError('');
    setNotice('');
  }

  async function requestEmail() {
    if (!challengeId || pending) return;
    setPending(true);
    setError('');
    try {
      await sendEmailCode({ challengeId });
      setEmailSent(true);
      setNotice('We sent a code to your email.');
    } catch (cause) {
      setError(formatAuthError(cause, 'verification'));
    } finally {
      setPending(false);
    }
  }

  const ready =
    method === 'recovery' ? code.replace(/[^a-z0-9]/gi, '').length === 12 : code.length === 6;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !ready || !challengeId) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('challengeId', challengeId);
    form.set('code', code.trim());
    form.set('method', method);
    form.set('flow', 'twoFactorVerification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code didn’t work. Check it and try again.');
      router.replace(nextPath ?? pendingGroupInvitationPath() ?? '/dashboard');
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.startsWith('That code')
          ? cause.message
          : 'That code didn’t work. Check it and try again.',
      );
      setCode('');
    } finally {
      setPending(false);
    }
  }

  const copy = COPY[method];
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
          <span className="auth-eyebrow">TWO-FACTOR SIGN-IN</span>
          <h1 id="auth-title">{copy.title}</h1>
          <p className="auth-description">{copy.description}</p>
          {methods.length > 1 ? (
            <div
              role="tablist"
              aria-label="Verification method"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}
            >
              {methods.map((value) => (
                <Button
                  key={value}
                  role="tab"
                  aria-selected={method === value}
                  size="sm"
                  variant={method === value ? 'primary' : 'outline'}
                  onPress={() => choose(value)}
                >
                  {ICONS[value]} {COPY[value].label}
                </Button>
              ))}
            </div>
          ) : null}
          <form method="post" onSubmit={submit} noValidate className="auth-form">
            {method === 'email' && !emailSent ? (
              <div className="auth-field">
                <p className="auth-helper">
                  We’ll email a six-digit code to the address on your account.
                </p>
                <Button
                  type="button"
                  size="lg"
                  onPress={() => void requestEmail()}
                  disabled={pending}
                >
                  {pending ? 'Sending…' : 'Email me a code'}
                </Button>
              </div>
            ) : (
              <>
                <div className="auth-field">
                  <span className="auth-label">
                    {method === 'recovery' ? 'Recovery code' : 'Six-digit code'}
                  </span>
                  {method === 'recovery' ? (
                    <Input
                      aria-label="Recovery code"
                      autoComplete="one-time-code"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="xxxx-xxxx-xxxx"
                      maxLength={16}
                      value={code}
                      onChangeText={setCode}
                    />
                  ) : (
                    <InputOTP value={code} onChangeText={setCode} />
                  )}
                </div>
                {notice ? (
                  <p className="auth-helper" role="status">
                    {notice}
                  </p>
                ) : null}
                {error ? (
                  <p className="auth-error" role="alert" aria-live="polite">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending || !ready || !challengeId}
                  aria-busy={pending}
                >
                  {pending ? 'Verifying…' : 'Verify and sign in'}
                </Button>
                {method === 'email' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => void requestEmail()}
                    disabled={pending}
                  >
                    Send a new code
                  </Button>
                ) : null}
              </>
            )}
            {method === 'email' && !emailSent && error ? (
              <p className="auth-error" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}
            <Link className="auth-back-link" href="/sign-in">
              <ArrowLeft size={15} /> Return to sign in
            </Link>
          </form>
        </div>
        <span className="auth-legal">
          Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
        </span>
      </section>
    </main>
  );
}
