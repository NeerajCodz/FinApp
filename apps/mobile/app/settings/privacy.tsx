import React from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Clock3,
  Download,
  Eye,
  HardDrive,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react-native';
import { Button } from '@finapp/ui/native';
import {
  SettingsChoice,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsScreen,
  SettingsSwitch,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { toast } from '@/lib/toast';
import { writeExportBundle } from '@/lib/export';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';

type PrivacyPatch = {
  showActive?: boolean;
  showLastSeen?: boolean;
  discoverable?: boolean;
  friendRequests?: 'everyone' | 'nobody';
};

/** Who can see and reach you, what Finapp keeps on this phone, and your data. */
export default function PrivacySettingsScreen() {
  const tone = useSettingsToneColor();
  const { userId, isConnected } = useLocalSync();
  const stored = useQuery(api.security.privacy, isConnected ? {} : 'skip');
  const update = useMutation(api.security.updatePrivacy);
  const requestDeletion = useMutation(api.security.requestDeletion);
  const [local, setLocal] = React.useState<typeof stored>(undefined);
  const [exporting, setExporting] = React.useState(false);
  React.useEffect(() => {
    if (stored) setLocal(stored);
  }, [stored]);
  const settings = local ?? stored;

  const transactions = useLocalRecords<LocalRecord>(userId, 'transaction');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const categories = useLocalRecords<LocalRecord>(userId, 'category');
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const settlements = useLocalRecords<LocalRecord>(userId, 'settlement');
  const records = [transactions, accounts, categories, groups, settlements];
  const ready =
    !!userId &&
    records.every((state) => !state.loading && !state.error && state.data !== undefined);

  const save = async (patch: PrivacyPatch) => {
    if (!settings) return;
    const previous = settings;
    setLocal({ ...settings, ...patch });
    try {
      const next = await update(patch);
      setLocal((current) => ({ ...current, ...next }));
    } catch {
      setLocal(previous);
      toast.error('Couldn’t save that change');
    }
  };

  const exportData = async () => {
    if (exporting || !ready) return;
    setExporting(true);
    try {
      await writeExportBundle({
        transactions: transactions.data!,
        accounts: accounts.data!,
        categories: categories.data!,
        groups: groups.data!,
        settlements: settlements.data!,
      });
      toast.success('Export ready');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const disabled = !isConnected || !settings;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <SettingsScreen title="Privacy" subtitle="Visibility, data and your account" onBack={back}>
      <SettingsHero
        icon={<ShieldCheck size={22} color={tone('positive')} />}
        title="Your amounts stay private"
        description="Balances, amounts and notes are never in telemetry. Only people you split with see shared expenses."
      />

      <SettingsGroup title="Who can find you">
        <SettingsSwitch
          icon={<Search size={19} color={tone('info')} />}
          tone="info"
          title="Show me in search"
          description="Off: people need your exact username"
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
          icon={<UserPlus size={19} color={tone()} />}
          title="Groups and splits"
          description="People can still add you after you share an invite link."
        />
      </SettingsGroup>

      <SettingsGroup title="Activity status">
        <SettingsSwitch
          icon={<Eye size={19} color={tone('positive')} />}
          tone="positive"
          title="Show when I’m active"
          description="Also shows when you’re typing"
          checked={settings?.showActive ?? true}
          disabled={disabled}
          onChange={(showActive) => void save({ showActive })}
        />
        <SettingsSwitch
          icon={<Clock3 size={19} color={tone('violet')} />}
          tone="violet"
          title="Show my last seen"
          checked={settings?.showLastSeen ?? true}
          disabled={disabled}
          onChange={(showLastSeen) => void save({ showLastSeen })}
        />
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsItem
          icon={<Download size={19} color={tone('primary')} />}
          tone="primary"
          title="Export your data"
          description={
            ready
              ? `${accounts.data!.length} accounts · ${transactions.data!.length} transactions · ${groups.data!.length} groups`
              : 'Counting your records…'
          }
          trailing={
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || exporting}
              onPress={() => void exportData()}
            >
              {exporting ? 'Preparing…' : 'Export'}
            </Button>
          }
        />
        <SettingsItem
          icon={<HardDrive size={19} color={tone()} />}
          title="Copy on this phone"
          description="Finapp keeps an encrypted copy on this phone so it works offline. Signing out removes it."
        />
        <SettingsLink
          icon={<Trash2 size={19} color={tone('warning')} />}
          tone="warning"
          title="Trash"
          description="Deleted items and when they’re removed"
          onPress={() => router.push('/settings/trash' as never)}
        />
      </SettingsGroup>

      <SettingsGroup title="Account">
        {settings?.deletionRequestedAt ? (
          <SettingsItem
            icon={<Trash2 size={19} color={tone('danger')} />}
            tone="danger"
            title="Deletion requested"
            description={`Requested ${new Date(settings.deletionRequestedAt).toLocaleDateString()}. Your account and data will be deleted.`}
            trailing={
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onPress={() =>
                  void requestDeletion({ cancel: true })
                    .then(() => toast.success('Deletion cancelled'))
                    .catch(() => toast.error('Couldn’t cancel'))
                }
              >
                Cancel
              </Button>
            }
          />
        ) : (
          <SettingsLink
            icon={<Trash2 size={19} color={tone('danger')} />}
            danger
            title="Delete my account"
            description="Permanently delete your account and data"
            onPress={
              disabled
                ? undefined
                : () =>
                    Alert.alert(
                      'Delete your account?',
                      'Your account and all its data will be permanently deleted. Export anything you want to keep first. You can cancel until it’s processed.',
                      [
                        { text: 'Keep account', style: 'cancel' },
                        {
                          text: 'Request deletion',
                          style: 'destructive',
                          onPress: () =>
                            void requestDeletion({})
                              .then(() => toast.success('Deletion requested'))
                              .catch(() => toast.error('Couldn’t send the request')),
                        },
                      ],
                    )
            }
          />
        )}
      </SettingsGroup>
    </SettingsScreen>
  );
}
