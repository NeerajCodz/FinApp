'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock3,
  Download,
  Eye,
  HardDrive,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button } from '@finapp/ui/web';
import {
  SettingsChoice,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsShell,
  SettingsSwitch,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { downloadFinanceBackup } from '@/lib/browser/export';

type PrivacyPatch = {
  showActive?: boolean;
  showLastSeen?: boolean;
  discoverable?: boolean;
  friendRequests?: 'everyone' | 'nobody';
};

/** Who can see and reach you, what Finapp keeps, and your data. */
export default function PrivacySettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const stored = useQuery(api.security.privacy, live ? {} : 'skip');
  const update = useMutation(api.security.updatePrivacy);
  const requestDeletion = useMutation(api.security.requestDeletion);
  const [local, setLocal] = React.useState<typeof stored>(undefined);
  const [message, setMessage] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  React.useEffect(() => {
    if (stored) setLocal(stored);
  }, [stored]);
  const settings = local ?? stored;

  const accounts = useLocalRecords<LocalRecord>('account');
  const transactions = useLocalRecords<LocalRecord>('transaction');
  const categories = useLocalRecords<LocalRecord>('category');
  const groups = useLocalRecords<LocalRecord>('group');
  const settlements = useLocalRecords<LocalRecord>('settlement');
  const all = [accounts, transactions, categories, groups, settlements];
  const loading = all.some((entry) => entry.loading);
  const dataError = all.find((entry) => entry.error)?.error;

  if (!userId)
    return (
      <FinanceSignedOut
        section="PRIVACY AND DATA"
        title="Your financial data stays yours."
        description="Sign in to choose who can find you and to export your data."
      />
    );

  const save = async (patch: PrivacyPatch) => {
    if (!settings) return;
    setMessage('');
    const previous = settings;
    setLocal({ ...settings, ...patch });
    try {
      const next = await update(patch);
      setLocal((current) => ({ ...current, ...next }));
    } catch {
      setLocal(previous);
      setMessage('Couldn’t save that change. Check your connection and try again.');
    }
  };

  const exportData = () => {
    if (loading || dataError || exporting) return;
    setExporting(true);
    setMessage('');
    try {
      downloadFinanceBackup({
        accounts: accounts.records,
        transactions: transactions.records,
        categories: categories.records,
        groups: groups.records,
        settlements: settlements.records,
      });
      setMessage('Your export is downloading.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Couldn’t prepare the export.');
    } finally {
      setExporting(false);
    }
  };

  const disabled = !live || !settings;
  return (
    <SettingsShell
      title="Privacy"
      subtitle="Visibility, data and your account"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={<ShieldCheck size={22} />}
        title="Your amounts stay private"
        description="Balances, amounts, account names and notes are never in telemetry, and only people you split with see shared expenses."
      />

      <SettingsGroup title="Who can find you" description="People search and friend requests">
        <SettingsSwitch
          icon={<Search size={19} />}
          tone="info"
          title="Show me in search"
          description="Off: people need your exact username to find you"
          checked={settings?.discoverable ?? true}
          disabled={disabled}
          onChange={(discoverable) => void save({ discoverable })}
        />
        <SettingsChoice
          title="Friend requests from"
          value={settings?.friendRequests ?? 'everyone'}
          disabled={disabled}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'nobody', label: 'Nobody' },
          ]}
          onChange={(friendRequests) => void save({ friendRequests })}
        />
        <SettingsItem
          icon={<UserPlus size={19} />}
          title="Groups and splits"
          description="People can still add you to a group or split once you share an invite link with them."
        />
      </SettingsGroup>

      <SettingsGroup title="Activity status" description="What people in your chats see">
        <SettingsSwitch
          icon={<Eye size={19} />}
          tone="positive"
          title="Show when I’m active"
          description="Also shows when you’re typing"
          checked={settings?.showActive ?? true}
          disabled={disabled}
          onChange={(showActive) => void save({ showActive })}
        />
        <SettingsSwitch
          icon={<Clock3 size={19} />}
          tone="violet"
          title="Show my last seen"
          checked={settings?.showLastSeen ?? true}
          disabled={disabled}
          onChange={(showLastSeen) => void save({ showLastSeen })}
        />
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsItem
          icon={<Download size={19} />}
          tone="primary"
          title="Export your data"
          description={
            loading
              ? 'Counting your records…'
              : dataError
                ? 'Your saved data couldn’t be read. Reload and try again.'
                : `CSV files: ${accounts.records.length} accounts, ${transactions.records.length} transactions, ${categories.records.length} categories, ${groups.records.length} groups, ${settlements.records.length} settlements`
          }
          trailing={
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !!dataError || exporting}
              onPress={exportData}
            >
              {exporting ? 'Preparing…' : 'Export'}
            </Button>
          }
        />
        <SettingsItem
          icon={<HardDrive size={19} />}
          title="Copy in this browser"
          description="Finapp keeps a copy here so it works offline. It isn’t encrypted separately, so anyone using this browser profile could read it. Use Profile → Sign out to clear this account’s saved finance records from this browser."
        />
        <SettingsLink
          icon={<Trash2 size={19} />}
          tone="warning"
          title="Trash"
          description="Deleted items and when they’re removed for good"
          onPress={() => router.push('/settings/trash')}
        />
      </SettingsGroup>

      <SettingsGroup title="Account">
        {settings?.deletionRequestedAt ? (
          <SettingsItem
            icon={<Trash2 size={19} />}
            tone="danger"
            title="Deletion requested"
            description={`Requested on ${new Date(settings.deletionRequestedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. Your account and data will be permanently deleted.`}
            trailing={
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onPress={() =>
                  void requestDeletion({ cancel: true })
                    .then(() => setMessage('Deletion cancelled. Your account stays.'))
                    .catch(() => setMessage('Couldn’t cancel. Try again.'))
                }
              >
                Cancel request
              </Button>
            }
          />
        ) : (
          <SettingsLink
            icon={<Trash2 size={19} />}
            danger
            title="Delete my account"
            description="Permanently delete your account and data. You can cancel until it’s processed."
            onPress={
              disabled
                ? undefined
                : () => {
                    if (
                      !window.confirm(
                        'Request permanent deletion of your Finapp account and all its data? Export anything you want to keep first.',
                      )
                    )
                      return;
                    void requestDeletion({})
                      .then(() => setMessage('Deletion requested. You can cancel it here.'))
                      .catch(() => setMessage('Couldn’t send the request. Try again.'));
                  }
            }
          />
        )}
      </SettingsGroup>

      {message || !isConnected ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {message || 'You’re offline. Reconnect to change privacy settings.'}
        </p>
      ) : null}
    </SettingsShell>
  );
}
