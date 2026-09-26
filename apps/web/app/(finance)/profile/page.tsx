'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, ChartNoAxesCombined, CircleUserRound, Coins, Settings2, Wallet } from 'lucide-react';
import { Avatar, Button, Card, Input, SectionHeader } from '@finapp/ui/web';
import { normalizePhone, normalizeUsername, validateProfileUpdate, type ProfileUpdate } from '@convex/users/domain';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & {
  displayName?: string;
  email?: string;
  username?: string;
  phone?: string;
  phoneVerificationTime?: number;
  defaultCurrency?: string;
};
type Editor = 'username' | 'phone' | null;

const links = [
  { label: 'Accounts', description: 'Balances and activity', href: '/accounts', icon: Wallet },
  { label: 'Groups', description: 'Shared money with people', href: '/groups', icon: CircleUserRound },
  { label: 'Budgets', description: 'Limits and progress', href: '/budgets', icon: Coins },
  { label: 'Analytics', description: 'Patterns over time', href: '/analytics', icon: ChartNoAxesCombined },
  { label: 'Notifications', description: 'Inbox and preferences', href: '/notifications', icon: Bell },
  { label: 'Settings', description: 'Appearance, sync, and privacy', href: '/settings', icon: Settings2 },
];


export default function ProfilePage() {
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Profile>('profile');
  const profile = records[0];
  const [editor, setEditor] = React.useState<Editor>(null);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  if (!userId)
    return (
      <FinanceSignedOut
        section="PROFILE"
        title="Your money, in your hands."
        description="Sign in to view your profile and edit the details used across your private ledger."
      />
    );

  async function save(update: ProfileUpdate) {
    if (!userId) throw new Error('AUTH_REQUIRED');
    const current: Profile = profile ?? { id: userId, displayName: 'Your profile' };
    const next = { ...current, ...update };
    if (update.phone !== undefined && update.phone !== profile?.phone)
      next.phoneVerificationTime = undefined;
    await commitLocalWrite(userId, 'profile', 'user.update', next, update, {
      recordId: String(current.id ?? current._id ?? userId),
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const update: ProfileUpdate = editor === 'username'
        ? { username: normalizeUsername(draft) }
        : { phone: normalizePhone(draft) };
      validateProfileUpdate(update);
      await save(update);
      setEditor(null);
      setMessage('Saved on this device. It will sync when connected.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save profile changes.');
    } finally {
      setBusy(false);
    }
  }

  function openEditor(value: Exclude<Editor, null>) {
    setMessage('');
    setEditor(value);
    setDraft(value === 'username' ? profile?.username ?? '' : profile?.phone ?? '');
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">YOUR ACCOUNT</p>
          <h1>Profile</h1>
          <p className="finance-muted">Your profile and the places you manage money.</p>
        </div>
        <Link className="finance-secondary-action" href="/settings">Settings</Link>
      </header>

      <Card className="finance-record-panel" style={{ display: 'grid', gap: 18 }}>
        <SectionHeader title="Profile details" action={<CircleUserRound size={18} aria-hidden="true" />} />
        {loading ? (
          <p className="finance-muted" role="status">Loading your local profile…</p>
        ) : error ? (
          <p className="finance-form-error" role="alert">Profile could not be loaded from this browser.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar initials={(profile?.displayName ?? 'Y').slice(0, 2)} label="Your profile" size={56} />
              <div style={{ display: 'grid', gap: 4 }}>
                <strong>{profile?.displayName ?? 'Your profile'}</strong>
                <span className="finance-muted">{profile?.email ?? 'Signed-in account'}</span>
              </div>
            </div>
            <div className="finance-record-list">
              <div className="finance-record-item">
                <div>
                  <strong>Username</strong>
                  <small>{profile?.username ? `@${profile.username}` : 'Not set'}</small>
                </div>
                <Button size="sm" variant="outline" onPress={() => openEditor('username')}>Edit</Button>
              </div>
              <div className="finance-record-item">
                <div>
                  <strong>Phone number</strong>
                  <small>
                    {profile?.phone
                      ? `${profile.phone} · ${profile.phoneVerificationTime ? 'Verified' : 'Not verified'}`
                      : 'Not set'}
                  </small>
                </div>
                <Button size="sm" variant="outline" onPress={() => openEditor('phone')}>Edit</Button>
              </div>
              <Link className="finance-record-item" href="/settings/currency" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div>
                  <strong>Default currency</strong>
                  <small>{profile?.defaultCurrency ?? 'INR'}</small>
                </div>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {editor && (
              <form className="finance-form" onSubmit={submit}>
                <label className="finance-form-field">
                  <span>{editor === 'username' ? 'Username' : 'Phone number'}</span>
                  <Input
                    autoComplete={editor === 'username' ? 'username' : 'tel'}
                    aria-label={editor === 'username' ? 'Username' : 'Phone number'}
                    maxLength={editor === 'username' ? 32 : 24}
                    onChangeText={setDraft}
                    placeholder={editor === 'username' ? '@yourname' : '+91 98765 43210'}
                    required
                    value={draft}
                  />
                </label>
                <p className="finance-form-note">
                  {editor === 'username'
                    ? 'Use 3–32 letters, numbers, or underscores. The server checks that usernames are available.'
                    : 'Use an international phone number. Group phone invites stay unavailable until it is verified.'}
                </p>
                {message && <p className="finance-form-error" role="alert">{message}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
                  <Button type="button" variant="outline" disabled={busy} onPress={() => setEditor(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </>
        )}
        {!editor && message && <p className="finance-settings-message" role="status">{message}</p>}
        {error && <Button variant="outline" onPress={() => window.location.reload()}>Reload profile</Button>}
      </Card>

      <section aria-labelledby="profile-workspace-title">
        <h2 id="profile-workspace-title" style={{ margin: '0 0 14px', fontSize: '1rem' }}>Money workspace</h2>
        <div className="finance-settings-grid">
          {links.map(({ label, description, href, icon: Icon }) => (
            <Card key={label} className="finance-settings-card">
              <SectionHeader title={label} action={<Icon size={18} aria-hidden="true" />} />
              <p>{description}</p>
              <Link className="finance-inline-link" href={href}>Open {label.toLowerCase()} <ArrowRight size={15} aria-hidden="true" /></Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
