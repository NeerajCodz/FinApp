import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, UsersThree } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { recordIds } from '@/lib/ledger';
import { Button, Card, Empty, IconButton, Separator, Typography } from '@/components/ui';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { SettingsRow } from '@/components/finance';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const groupState = useLocalRecords<LocalRecord>(userId, 'group');
  const memberState = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const group = groupState.data?.find((record) => id && recordIds(record).includes(id));
  const groupIds = group ? recordIds(group) : [];
  const members = memberState.data?.filter(
    (record) => typeof record.groupId === 'string' && groupIds.includes(record.groupId),
  ) ?? [];
  const loading = groupState.loading || memberState.loading;
  const error = groupState.error || memberState.error;
  const retry = () => { groupState.retry(); memberState.retry(); };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Group settings</Typography>
      </View>

      {!id ? (
        <Empty title="Missing group ID" description="Open settings from a saved group." />
      ) : error ? (
        <Empty
          title="Group settings unavailable"
          description="Saved group details could not be loaded."
          icon={<UsersThree size={28} color={tokens.foregroundMuted} />}
          action={<Button variant="outline" onPress={retry}>Retry</Button>}
        />
      ) : loading ? (
        <Typography variant="small">Loading group details…</Typography>
      ) : !group ? (
        <Empty title="Group unavailable" description="This group is not saved on this device." />
      ) : (
        <>
          <Card variant="subtle" style={{ gap: 10, borderWidth: 1, borderColor: tokens.borderSubtle }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <UsersThree size={24} color={tokens.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Typography variant="heading" numberOfLines={2}>{String(group.name ?? 'Group')}</Typography>
                <Typography variant="caption">
                  {group.archivedAt === undefined ? 'Active group' : 'Archived group'}
                </Typography>
              </View>
            </View>
          </Card>

          <View>
            <Typography variant="label" style={{ marginBottom: 8 }}>General</Typography>
            <SettingsRow label="Group name" value={String(group.name ?? 'Group')} />
            <Separator />
            <SettingsRow label="Members" value={String(members.length)} />
            <Separator />
            <SettingsRow label="Currency" value={String(group.currency ?? 'INR')} />
          </View>

          <View style={{ gap: 10 }}>
            <Typography variant="label">Group controls</Typography>
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              Group archiving is not available on this device. No group data has been changed.
            </Typography>
          </View>
        </>
      )}
    </ScrollView>
  );
}
