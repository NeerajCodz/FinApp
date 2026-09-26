'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  getPasscodeLockStatus,
  hasBrowserLock,
  isWebAuthnLockAvailable,
} from '@/lib/security/webauthn-lock';

export default function SecuritySettingsPage() {
  const { userId } = useBrowserSync();
  const [available, setAvailable] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [passcodeEnabled, setPasscodeEnabled] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    void isWebAuthnLockAvailable()
      .then((result) => {
        if (active) setAvailable(result);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    if (userId) {
      try {
        setEnabled(hasBrowserLock(userId));
        setPasscodeEnabled(getPasscodeLockStatus(userId).configured);
      } catch {
        setError('Browser storage is unavailable; the screen-lock state cannot be read.');
      }
    } else {
      setEnabled(false);
      setPasscodeEnabled(false);
    }
    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId)
    return (
      <FinanceSignedOut
        section="SECURITY"
        title="Keep access in your control."
        description="Sign in to review the browser screen-lock status for this account."
      />
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">ACCOUNT ACCESS</p>
          <h1>Security</h1>
          <p className="finance-muted">Review this browser’s passkey and passcode screen lock.</p>
        </div>
      </header>
      <Card className="finance-settings-card">
        <SectionHeader
          title="Browser screen lock"
          action={<Fingerprint size={18} aria-hidden="true" />}
        />
        <p>
          {enabled
            ? `A browser lock is enabled${passcodeEnabled ? ' with a six-digit passcode configured.' : '.'}`
            : 'No passkey or passcode lock is enabled for this browser.'}
        </p>
        <p>
          {available
            ? 'A platform authenticator is available. Configure a passkey or passcode from Settings.'
            : passcodeEnabled
              ? 'Passkeys are unavailable here; the configured six-digit passcode remains available.'
              : 'Passkeys require a secure browser context and supported platform authenticator. A six-digit passcode is also available.'}
        </p>
        <p>
          This is a screen-level gate, not encryption. Browser IndexedDB and WebAuthn are scoped to
          this origin and browser profile; they do not provide the native SQLCipher or SecureStore
          guarantee.
        </p>
        {error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
        <Link className="finance-inline-link" href="/settings">
          Manage the browser lock in Settings <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </Card>
      <Card className="finance-settings-card">
        <SectionHeader
          title="Browser privacy"
          action={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <p>
          Remove the local copy or read the complete browser-storage disclosure from the privacy
          controls.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link className="finance-secondary-action" href="/settings/privacy">
            Privacy and data
          </Link>
          <Button variant="outline" onPress={() => window.location.assign('/privacy')}>
            Read privacy notes
          </Button>
        </div>
      </Card>
    </div>
  );
}
