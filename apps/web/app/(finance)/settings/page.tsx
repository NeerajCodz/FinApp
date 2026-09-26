'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowRight, Bell, Download, Fingerprint, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { clearLocalData, type LocalRecord } from '@/lib/offline/repository';
import { downloadFinanceBackup } from '@/lib/browser/export';
import {
  disableWebAuthnLock,
  enableWebAuthnLock,
  hasWebAuthnLock,
  isWebAuthnLockAvailable,
} from '@/lib/security/webauthn-lock';

type Account = LocalRecord;
type Transaction = LocalRecord;
type Category = LocalRecord;
type Budget = LocalRecord;
type Goal = LocalRecord;

export default function SettingsPage() {
  const { userId, status } = useBrowserSync();
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const { records: categories } = useLocalRecords<Category>('category');
  const { records: budgets } = useLocalRecords<Budget>('budget');
  const { records: goals } = useLocalRecords<Goal>('goal');
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [lockEnabled, setLockEnabled] = React.useState(false);
  const [lockAvailable, setLockAvailable] = React.useState(false);

  React.useEffect(() => {
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    void isWebAuthnLockAvailable().then(setLockAvailable);
    try {
      setLockEnabled(Boolean(userId && hasWebAuthnLock(userId)));
    } catch {
      setMessage('Browser storage is unavailable; the passkey lock cannot be changed.');
    }
  }, [userId]);

  const exportData = () => {
    const stamp = new Date();
    downloadFinanceBackup({ accounts, categories, transactions, budgets, goals }, stamp);
    setMessage(
      `Five CSV tables were prepared in a ZIP: ${accounts.length} accounts, ${categories.length} categories, ${transactions.length} transactions, ${budgets.length} budgets, ${goals.length} goals.`,
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
        setMessage('The passkey screen lock was removed from this browser.');
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
    if (
      !userId ||
      !window.confirm(
        'Remove this user’s offline copy from this browser? Data on your synced account is not deleted.',
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
      <div className="finance-settings-grid">
        <Card className="finance-settings-card">
          <SectionHeader
            title="Take your data"
            action={<Download size={17} aria-hidden="true" />}
          />
          <p>
            Download all five financial tables as CSV files in one ZIP. Record JSON columns retain
            fields not shown individually; amounts remain in minor units. Export runs only when you
            request it.
          </p>
          <p className="finance-settings-count">
            {accounts.length} accounts · {categories.length} categories · {transactions.length}{' '}
            transactions · {budgets.length} budgets · {goals.length} goals in this browser
          </p>
          <Button
            onPress={exportData}
            disabled={
              accounts.length +
                categories.length +
                transactions.length +
                budgets.length +
                goals.length ===
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
            title="Passkey screen lock"
            action={<Fingerprint size={17} aria-hidden="true" />}
          />
          <p>
            {lockEnabled
              ? 'A platform authenticator is required before this browser session opens.'
              : 'Require a platform passkey before opening this browser session.'}
          </p>
          <p>
            This is a screen-level gate, not encryption. Browser-profile access can still expose
            offline data; remove it separately below.
          </p>
          <Button
            variant={lockEnabled ? 'secondary' : 'primary'}
            onPress={changeBrowserLock}
            disabled={!userId || !lockAvailable || busy}
            aria-busy={busy}
          >
            {lockEnabled ? 'Remove passkey lock' : 'Enable passkey lock'}
          </Button>
          {!lockAvailable && (
            <p className="finance-settings-count">
              A supported platform authenticator in a secure browser context is required.
            </p>
          )}
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
