'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowRight, Bell, Download, Fingerprint, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, Input, Label, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { clearLocalData, type LocalRecord } from '@/lib/offline/repository';
import { downloadFinanceBackup } from '@/lib/browser/export';
import {
  disableWebAuthnLock,
  enableWebAuthnLock,
  getPasscodeLockStatus,
  hasBrowserLock,
  isWebAuthnLockAvailable,
  setPasscodeLock,
} from '@/lib/security/webauthn-lock';

type Account = LocalRecord;
type Transaction = LocalRecord;
type Category = LocalRecord;
type Group = LocalRecord;
type Settlement = LocalRecord;

export default function SettingsPage() {
  const { userId, status } = useBrowserSync();
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const { records: categories } = useLocalRecords<Category>('category');
  const { records: groups } = useLocalRecords<Group>('group');
  const { records: settlements } = useLocalRecords<Settlement>('settlement');
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [lockEnabled, setLockEnabled] = React.useState(false);
  const [lockAvailable, setLockAvailable] = React.useState(false);
  const [passcodeEnabled, setPasscodeEnabled] = React.useState(false);
  const [passcode, setPasscode] = React.useState('');
  const [passcodeConfirm, setPasscodeConfirm] = React.useState('');

  React.useEffect(() => {
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    void isWebAuthnLockAvailable().then(setLockAvailable);
    try {
      setLockEnabled(Boolean(userId && hasBrowserLock(userId)));
      setPasscodeEnabled(Boolean(userId && getPasscodeLockStatus(userId).configured));
    } catch {
      setMessage('Browser storage is unavailable; the local lock cannot be changed.');
    }
  }, [userId]);

  const exportData = () => {
    const stamp = new Date();
    downloadFinanceBackup({ accounts, transactions, categories, groups, settlements }, stamp);
    setMessage(
      `Five CSV tables were prepared in a ZIP: ${accounts.length} accounts, ${transactions.length} transactions, ${categories.length} categories, ${groups.length} groups, ${settlements.length} settlements.`,
    );
  };

  const changeBrowserLock = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (lockEnabled) {
        disableWebAuthnLock(userId);
        setLockEnabled(false);
        setPasscodeEnabled(false);
        setMessage('The browser lock was removed from this browser.');
      } else {
        await enableWebAuthnLock(userId);
        setLockEnabled(true);
        setMessage('A passkey screen lock is enabled for this browser and account.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update the passkey lock.');
    } finally {
      setBusy(false);
    }
  };

  async function savePasscode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy || !/^\d{6}$/.test(passcode)) return;
    if (passcode !== passcodeConfirm) {
      setMessage('The passcodes do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await setPasscodeLock(userId, passcode);
      setLockEnabled(true);
      setPasscodeEnabled(true);
      setPasscode('');
      setPasscodeConfirm('');
      setMessage('The six-digit browser passcode is enabled. It does not encrypt offline data.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not set the browser passcode.');
    } finally {
      setBusy(false);
    }
  }

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    setMessage(
      result === 'granted'
        ? 'Browser notifications are enabled for this open app session.'
        : 'Notifications were not enabled. You can change this in your browser settings.',
    );
  };

  const removeLocalCopy = async () => {
    const unsynced = status.pending + status.syncing + status.failed + status.conflicts;
    const pendingWarning =
      unsynced > 0
        ? ` This will permanently remove ${unsynced} queued, failed, or conflicted changes that may not have reached your account.`
        : '';
    if (
      !userId ||
      !window.confirm(
        `Remove this user's offline copy from this browser? Synced account data will remain on your account.${pendingWarning}`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      await clearLocalData(userId);
      setMessage('The local offline copy was removed. Synced account data was not deleted.');
    } catch {
      setMessage('The local copy could not be removed. Retry while this browser is available.');
    } finally {
      setBusy(false);
    }
  };

  const leaveSession = async () => {
    setBusy(true);
    try {
      await signOut();
      window.localStorage.removeItem('finapp.web.validated-user.v1');
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  if (!userId) {
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">PREFERENCES</p>
        <h1>Your workspace, your terms.</h1>
        <p>
          Sign in to manage exports, browser permissions, and the offline copy stored on this
          device.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">CONTROL ROOM</p>
          <h1>Settings</h1>
          <p className="finance-muted">
            Signed in · {status.pending + status.syncing} queued · {status.failed} failed ·{' '}
            {status.conflicts} conflicts
          </p>
        </div>
      </header>
      <section aria-label="Settings subsections" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>More settings</h2>
        <nav className="finance-settings-grid" aria-label="Settings subsections">
          {[
            {
              label: 'Appearance',
              detail: 'Choose dark, light, or system theme.',
              href: '/settings/appearance',
            },
            {
              label: 'Currency',
              detail: 'Set the default currency for new records.',
              href: '/settings/currency',
            },
            {
              label: 'Security',
              detail: 'Review this browser’s passkey screen lock.',
              href: '/settings/security',
            },
            {
              label: 'Local sync',
              detail: 'Retry changes and resolve saved conflicts.',
              href: '/settings/sync',
            },
            {
              label: 'Privacy and data',
              detail: 'Review browser storage and export controls.',
              href: '/settings/privacy',
            },
            {
              label: 'Notification preferences',
              detail: 'Choose which updates reach your inbox.',
              href: '/settings/notifications',
            },
          ].map((item) => (
            <Card key={item.href} className="finance-settings-card">
              <h3 style={{ margin: 0, color: 'var(--finance-text)', fontSize: '0.95rem' }}>
                {item.label}
              </h3>
              <p>{item.detail}</p>
              <Link className="finance-inline-link" href={item.href}>
                Open {item.label} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Card>
          ))}
        </nav>
      </section>
      <div className="finance-settings-grid">
        <Card className="finance-settings-card">
          <SectionHeader
            title="Take your data"
            action={<Download size={17} aria-hidden="true" />}
          />
          <p>
            Download locally available accounts, transactions, categories, groups, and settlements
            as one ZIP containing five CSV files. Export uses the canonical Finapp CSV format and
            runs only when you request it.
          </p>
          <p className="finance-settings-count">
            {accounts.length} accounts · {transactions.length} transactions · {categories.length}{' '}
            categories · {groups.length} groups · {settlements.length} settlements in this browser
          </p>
          <Button
            onPress={exportData}
            disabled={
              accounts.length +
                transactions.length +
                categories.length +
                groups.length +
                settlements.length ===
              0
            }
          >
            Export five-table ZIP
          </Button>
        </Card>
        <Card className="finance-settings-card">
          <SectionHeader
            title="Browser notifications"
            action={<Bell size={17} aria-hidden="true" />}
          />
          <p>
            Notifications are only shown while Finapp is open in this browser. Background push
            notifications are not configured.
          </p>
          <p className="finance-settings-count">Permission: {permission}</p>
          <Button
            onPress={enableNotifications}
            disabled={permission === 'granted' || permission === 'unsupported'}
          >
            Enable notifications
          </Button>
        </Card>
        <Card className="finance-settings-card">
          <SectionHeader
            title="Browser app lock"
            action={<Fingerprint size={17} aria-hidden="true" />}
          />
          <p>
            {lockEnabled
              ? 'A passkey or six-digit passcode is required before this browser session opens.'
              : 'Use a platform passkey where supported, or set a six-digit passcode below.'}
          </p>
          <p>
            Five failed attempts trigger a 30-second lockout. This screen-level gate is not
            encryption; browser-profile or developer tools access can still expose offline data.
          </p>
          <Button
            variant={lockEnabled ? 'secondary' : 'primary'}
            onPress={changeBrowserLock}
            disabled={!userId || busy || (!lockEnabled && !lockAvailable)}
            aria-busy={busy}
          >
            {lockEnabled ? 'Remove browser lock' : 'Enable passkey lock'}
          </Button>
          {!lockAvailable && !lockEnabled && (
            <p className="finance-settings-count">
              Passkeys are unavailable in this browser. A six-digit passcode still works.
            </p>
          )}
          <form onSubmit={savePasscode} className="auth-form">
            <p className="finance-settings-count">
              {passcodeEnabled
                ? 'Passcode configured; enter a new one to replace it.'
                : 'Set a six-digit browser passcode.'}
            </p>
            <div className="auth-field">
              <Label htmlFor="browser-lock-passcode">Six-digit passcode</Label>
              <Input
                id="browser-lock-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={passcode}
                onChangeText={setPasscode}
                required
              />
            </div>
            <div className="auth-field">
              <Label htmlFor="browser-lock-passcode-confirm">Confirm passcode</Label>
              <Input
                id="browser-lock-passcode-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={passcodeConfirm}
                onChangeText={setPasscodeConfirm}
                required
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={
                !userId || busy || !/^\d{6}$/.test(passcode) || !/^\d{6}$/.test(passcodeConfirm)
              }
            >
              {passcodeEnabled ? 'Replace passcode' : 'Set passcode'}
            </Button>
          </form>
        </Card>
        <Card className="finance-settings-card">
          <SectionHeader
            title="Your browser copy"
            action={<ShieldCheck size={17} aria-hidden="true" />}
          />
          <p>
            Offline data is stored in this browser profile and is not separately encrypted by
            Finapp. Anyone with access to this profile may be able to access it.
          </p>
          <p>
            Removing this copy does not delete synced data from your account. See the{' '}
            <Link href="/privacy">privacy notes</Link>.
          </p>
          <Button variant="secondary" onPress={removeLocalCopy} disabled={busy}>
            <Trash2 size={15} /> Remove offline copy
          </Button>
        </Card>
        <Card className="finance-settings-card">
          <SectionHeader title="Session" action={<LogOut size={17} aria-hidden="true" />} />
          <p>
            Sign out of this browser session. Offline data remains on this browser unless you remove
            it separately.
          </p>
          <Button variant="secondary" onPress={leaveSession} disabled={busy}>
            Sign out
          </Button>
        </Card>
      </div>
      {message && (
        <p className="finance-settings-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
