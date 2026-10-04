import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';
import { writeExportBundle } from '@/lib/export';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { Button, IconButton, Separator, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
export default function PrivacySettingsScreen() {
  const [exporting, setExporting] = useState(false);
  const [updatingPresence, setUpdatingPresence] = useState(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const privacy = useQuery(api.presence.queries.privacySettings, {});
  const setPrivacy = useMutation(api.presence.mutations.setPrivacy);
  const { userId } = useLocalSync();
  const transactions = useLocalRecords<LocalRecord>(userId, 'transaction');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const categories = useLocalRecords<LocalRecord>(userId, 'category');
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const settlements = useLocalRecords<LocalRecord>(userId, 'settlement');
  const records = [transactions, accounts, categories, groups, settlements];
  const ready =
    !!userId &&
    records.every((state) => !state.loading && !state.error && state.data !== undefined);

  async function exportData() {
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
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Privacy</Typography>
      </View>

      <View style={{ gap: 12 }}>
        <Typography variant="heading">Your financial values stay private.</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
          Ordinary telemetry never includes balances, amounts, account names, or transaction notes.
        </Text>
      </View>

      <Separator />

      <View style={{ gap: 14 }}>
        <Typography variant="label">Presence</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          Choose what people in your chats can see when you use Finapp.
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Typography variant="bodyLarge">Show active status</Typography>
            <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
              Let people you chat with know when you are active.
            </Text>
          </View>
          <Switch
            value={privacy?.showActive ?? true}
            disabled={!privacy || updatingPresence}
            onValueChange={(showActive) => {
              if (!privacy) return;
              setUpdatingPresence(true);
              void setPrivacy({ showActive, showLastSeen: privacy.showLastSeen })
                .catch(() => toast.error('Could not update privacy settings'))
                .finally(() => setUpdatingPresence(false));
            }}
            trackColor={{ true: tokens.primary }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Typography variant="bodyLarge">Show last seen</Typography>
            <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
              Let people you chat with see when you were last active.
            </Text>
          </View>
          <Switch
            value={privacy?.showLastSeen ?? true}
            disabled={!privacy || updatingPresence}
            onValueChange={(showLastSeen) => {
              if (!privacy) return;
              setUpdatingPresence(true);
              void setPrivacy({ showActive: privacy.showActive, showLastSeen })
                .catch(() => toast.error('Could not update privacy settings'))
                .finally(() => setUpdatingPresence(false));
            }}
            trackColor={{ true: tokens.primary }}
          />
        </View>
      </View>

      <Separator />

      <View style={{ gap: 12 }}>
        <Typography variant="label">Your data</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
          Export portable CSV files for accounts, transactions, categories, groups, and settlements.
        </Text>
        <Button
          variant="outline"
          disabled={!ready || exporting}
          onPress={exportData}
          style={{ alignSelf: 'flex-start' }}
        >
          {exporting ? 'Preparing export' : 'Export data'}
        </Button>
      </View>

      <View style={{ gap: 10 }}>
        <Typography variant="label" style={{ color: tokens.destructive }}>
          Account deletion
        </Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
          Contact support from your verified email to request permanent deletion.
        </Text>
      </View>
    </ScrollView>
  );
}
