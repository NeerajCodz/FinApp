import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  CalendarClock,
  Landmark,
  ReceiptText,
  RotateCcw,
  Settings,
  Tags,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsIconButton,
  SettingsScreen,
} from '@finapp/ui/finance';
import { Text, useTheme } from '@finapp/ui/native';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Kind = 'transaction' | 'account' | 'category' | 'budget' | 'goal' | 'recurring';
const LABEL: Record<Kind, string> = {
  transaction: 'Transactions',
  account: 'Accounts',
  category: 'Categories',
  // Budgets trashed before they became category limits; restoring sets the category's limit.
  budget: 'Old budgets',
  goal: 'Goals',
  recurring: 'Recurring',
};
const ICON: Record<Kind, React.ComponentType<{ size?: number; color?: string }>> = {
  transaction: ReceiptText,
  account: Landmark,
  category: Tags,
  budget: Wallet,
  goal: Target,
  recurring: CalendarClock,
};
const back = () =>
  router.canGoBack() ? router.back() : router.navigate('/(tabs)/profile' as never);
const errorText = (cause: unknown) => {
  const raw = cause instanceof Error ? cause.message : '';
  if (raw.includes('ACCOUNT_IN_TRASH')) return 'Restore its account first.';
  if (raw.includes('NOT_FOUND')) return 'That item is no longer in Trash.';
  return 'Something went wrong. Try again.';
};
function remaining(purgeAt: number | null) {
  if (purgeAt === null) return 'Kept until you delete it';
  const days = Math.max(0, Math.ceil((purgeAt - Date.now()) / 86_400_000));
  return days <= 1 ? 'Deleted within a day' : `Deleted in ${days} days`;
}

export default function TrashScreen() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const { tokens } = useTheme();
  const data = useQuery(api.trash.list, live ? {} : 'skip');
  const restore = useMutation(api.trash.restore);
  const purge = useMutation(api.trash.purge);
  const empty = useMutation(api.trash.empty);
  const [filter, setFilter] = React.useState<Kind | 'all'>('all');
  const items = data?.items ?? [];
  const visible = filter === 'all' ? items : items.filter((item) => item.kind === filter);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
    } catch (cause) {
      toast.error(errorText(cause));
    }
  };

  return (
    <SettingsScreen
      title="Trash"
      subtitle={
        data
          ? data.retentionDays > 0
            ? `Deleted for good after ${data.retentionDays} ${data.retentionDays === 1 ? 'day' : 'days'}`
            : 'Kept until you delete them'
          : 'Deleted items you can restore'
      }
      onBack={back}
      actions={
        <SettingsIconButton
          label="Trash settings"
          onPress={() => router.push('/settings/trash' as never)}
        >
          <Settings size={19} color={tokens.foreground} />
        </SettingsIconButton>
      }
    >
      <SettingsHero
        icon={<Trash2 size={22} color={tokens.primary} />}
        title={
          items.length
            ? `${items.length} ${items.length === 1 ? 'item' : 'items'} in Trash`
            : 'Trash is empty'
        }
        description="Restore brings an item back as it was. Chat messages aren’t kept in Trash."
        action={
          items.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Empty Trash?', 'Everything here is deleted for good.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Empty',
                    style: 'destructive',
                    onPress: () =>
                      void run(async () => {
                        for (let round = 0; round < 50; round += 1) {
                          const result = await empty({});
                          if (!result.more) break;
                        }
                      }, 'Trash emptied'),
                  },
                ])
              }
              style={{
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: tokens.expense, fontWeight: '600', fontSize: 13 }}>Empty</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {(['all', 'transaction', 'account', 'category', 'goal', 'recurring'] as const).map(
          (kind) => {
            const active = filter === kind;
            const count =
              kind === 'all' ? items.length : items.filter((item) => item.kind === kind).length;
            return (
              <Pressable
                key={kind}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(kind)}
                style={{
                  height: 34,
                  paddingHorizontal: 12,
                  borderRadius: 17,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: active ? tokens.primary : tokens.borderSubtle,
                  backgroundColor: active ? `${tokens.primary}22` : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: active ? tokens.foreground : tokens.foregroundMuted,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {kind === 'all' ? 'All' : LABEL[kind]}
                </Text>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>{count}</Text>
              </Pressable>
            );
          },
        )}
      </ScrollView>
      <SettingsGroup>
        {data === undefined ? (
          <Text style={{ padding: 16, color: tokens.foregroundMuted }}>
            {live ? 'Loading…' : 'Connect to the internet to open Trash.'}
          </Text>
        ) : visible.length ? (
          visible.map((item) => {
            const Icon = ICON[item.kind as Kind] ?? Trash2;
            return (
              <View
                key={`${item.kind}:${item.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <Icon size={18} color={tokens.foregroundMuted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: tokens.foreground, fontWeight: '600' }}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                    {item.subtitle} · {remaining(item.purgeAt)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${item.title}`}
                  onPress={() =>
                    void run(
                      () => restore({ kind: item.kind, id: item.id }),
                      `${item.title} restored`,
                    )
                  }
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={16} color={tokens.foreground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title} for good`}
                  onPress={() =>
                    Alert.alert(
                      `Delete “${item.title}” for good?`,
                      item.kind === 'account'
                        ? 'Its transactions are deleted too. This can’t be undone.'
                        : item.kind === 'goal'
                          ? 'Its contributions are deleted too. This can’t be undone.'
                          : 'This can’t be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            void run(
                              () => purge({ kind: item.kind, id: item.id }),
                              `${item.title} deleted`,
                            ),
                        },
                      ],
                    )
                  }
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} color={tokens.expense} />
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text style={{ padding: 16, color: tokens.foregroundMuted }}>Nothing here.</Text>
        )}
      </SettingsGroup>
    </SettingsScreen>
  );
}
