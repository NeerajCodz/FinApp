'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Landmark } from 'lucide-react';
import { Button, IconButton, Input, Label, Typography } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, idOf, localDependency, matchesId, SignInGate } from '../../../_personal';

type Account = LocalRecord & {
  name?: string;
  type?: string;
  customType?: string;
  currency?: string;
  updatedAt?: number;
  archivedAt?: number;
};

const accountTypeLabels: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
  loan: 'Loan',
  other: 'Custom',
};

export default function EditAccountPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Account>('account');
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  React.useEffect(() => {
    if (account) setName(account.name ?? '');
  }, [account?._id, account?.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !account || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Enter an account name.');
      return;
    }
    const accountId = String(account._id ?? account.cloudId ?? account.id ?? '');
    if (!accountId) {
      setFormError('This account has no saved identifier.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const dependency = localDependency('account', account);
      await commitLocalWrite(
        userId,
        'account',
        'account.rename',
        { ...account, name: trimmedName },
        { accountId, name: trimmedName },
        {
          recordId: idOf(account),
          dependencies: dependency ? [dependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      router.replace(`/account/${encodeURIComponent(accountId)}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this account.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="EDIT ACCOUNT" title="Update your account.">
        Sign in to edit a private account record.
      </SignInGate>
    );

  if (loading)
    return (
      <div className="finance-page">
        <Typography variant="small" role="status">
          Loading account details…
        </Typography>
      </div>
    );

  if (!account || account.archivedAt !== undefined)
    return (
      <div className="finance-page" style={{ gap: 16 }}>
        <Typography variant="title">Account unavailable</Typography>
        <Typography variant="small">{error ?? 'This account could not be found.'}</Typography>
        <Button variant="outline" onPress={() => router.replace('/accounts')}>
          Back to accounts
        </Button>
      </div>
    );

  return (
    <div className="finance-page" style={{ gap: 24, minHeight: '70vh' }}>
      <IconButton
        label="Go back"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => router.back()}
      >
        <ArrowLeft size={21} aria-hidden="true" />
      </IconButton>
      <header style={{ display: 'grid', gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 14,
            background: 'var(--finapp-surface-raised)',
          }}
        >
          <Landmark size={21} color="var(--finapp-foreground)" />
        </span>
        <Typography variant="title">Edit account</Typography>
        <Typography variant="small" style={{ maxWidth: 320 }}>
          Update the name shown across your accounts and activity.
        </Typography>
      </header>
      <form onSubmit={save} style={{ display: 'grid', flex: 1, gap: 18 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            accessibilityLabel="Account name"
            value={name}
            onChangeText={setName}
            placeholder="Everyday account"
            maxLength={80}
            required
          />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label>Type</Label>
          <Typography variant="bodyLarge">
            {accountTypeLabels[account.type ?? ''] ?? account.customType ?? 'Account'}
          </Typography>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label>Currency</Label>
          <Typography variant="bodyLarge">{account.currency ?? '—'}</Typography>
        </div>
        <div style={{ flex: 1 }} />
        {formError && (
          <p className="finance-form-error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" style={{ width: '100%' }} disabled={saving || !name.trim()}>
          <Check size={18} aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
