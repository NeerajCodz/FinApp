import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetDetailItem = {
  id: string;
  title: string;
  date: string;
  amountMinor: bigint;
  currency: string;
};
export function BudgetDetailScreen({
  name,
  category,
  icon,
  currency,
  limit,
  spent,
  transactions,
  loading,
  error,
  actionError,
  pending,
  onEdit,
  onAnalytics,
  onArchive,
  onOpenTransaction,
}: {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  spent: bigint;
  transactions: readonly BudgetDetailItem[];
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  pending?: boolean;
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
  onOpenTransaction: (id: string) => void;
}) {
  const { tokens } = useTheme();
  const ratio = limit > 0n ? Number((spent * 10000n) / limit) / 100 : 0;
  const remaining = limit - spent;
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingTop: 16, paddingBottom: 40, gap: 16 }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CategoryIcon label={category} icon={icon} />
        <View style={{ flex: 1 }}>
          <Typography variant="title">{name}</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>{category} · Category budget</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button variant="outline" onPress={onAnalytics} style={{ flex: 1 }}>
          Analytics
        </Button>
        <Button onPress={onEdit} style={{ flex: 1 }}>
          Edit
        </Button>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          ['Spending limit', formatMinor(limit, currency)],
          ['Spent so far', formatMinor(spent, currency)],
          ['Remaining', formatMinor(remaining, currency)],
          ['Progress', `${ratio.toFixed(1)}%`],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{
              flexGrow: 1,
              minWidth: 125,
              padding: 14,
              borderRadius: 15,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Text style={{ color: tokens.foregroundMuted }}>{label}</Text>
            <Typography variant="heading">{value}</Typography>
          </View>
        ))}
      </View>
      <Button variant="outline" disabled={pending} onPress={onArchive}>
        Archive budget
      </Button>
      {actionError && <Text style={{ color: tokens.destructive }}>{actionError}</Text>}
      {error && <Text style={{ color: tokens.destructive }}>{error}</Text>}
      {loading ? (
        <Text>Loading posted expenses…</Text>
      ) : transactions.length ? (
        <View style={{ gap: 8 }}>
          {transactions.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenTransaction(item.id)}
              style={{ padding: 14, borderRadius: 14, backgroundColor: tokens.surfaceRaised }}
            >
              <Text>{item.title}</Text>
              <Text style={{ color: tokens.foregroundMuted }}>
                {item.date} · {formatMinor(item.amountMinor, item.currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text>No posted expenses are available for this budget.</Text>
      )}
    </ScrollView>
  );
}
