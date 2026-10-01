import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetOverviewItem = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  currency: string;
  spentMinor: bigint;
  limitMinor: bigint;
  startAt: number;
  endAt: number;
};
export function BudgetOverviewScreen({
  items,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  items: readonly BudgetOverviewItem[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingTop: 16, paddingBottom: 40, gap: 20 }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Typography variant="title">Budgets</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Monitor category limits and understand your spending.
          </Text>
        </View>
        <Button onPress={onCreate}>＋ New</Button>
      </View>
      {loading ? (
        <Text accessibilityRole="text">Loading your budgets…</Text>
      ) : error ? (
        <Text style={{ color: tokens.destructive }}>{error}</Text>
      ) : !items.length ? (
        <View
          style={{
            padding: 20,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 18,
            gap: 12,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <Typography variant="bodyLarge">No category budgets yet</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Create a budget for a category you already use. Only posted expenses in that category
            count.
          </Text>
          <Button onPress={onCreate}>Create a budget</Button>
        </View>
      ) : (
        items.map((item) => {
          const progress =
            item.limitMinor > 0n ? Number((item.spentMinor * 10000n) / item.limitMinor) / 100 : 0;
          const remaining = item.limitMinor - item.spentMinor;
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpen(item.id)}
              style={{
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                backgroundColor: tokens.surfaceRaised,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <CategoryIcon label={item.category} icon={item.icon} />
                <View style={{ flex: 1 }}>
                  <Typography variant="bodyLarge">{item.name}</Typography>
                  <Text style={{ color: tokens.foregroundMuted }}>
                    {new Date(item.startAt).toLocaleDateString()} –{' '}
                    {new Date(item.endAt - 1).toLocaleDateString()}
                  </Text>
                </View>
                <Typography variant="caption">{progress.toFixed(1)}%</Typography>
              </View>
              <View
                style={{
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: tokens.surfaceSubtle,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, progress))}%`,
                    backgroundColor: tokens.primary,
                  }}
                />
              </View>
              <Text>
                {formatMinor(item.spentMinor, item.currency)} spent ·{' '}
                {formatMinor(remaining, item.currency)} remaining of{' '}
                {formatMinor(item.limitMinor, item.currency)}
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}
