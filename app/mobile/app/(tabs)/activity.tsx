import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { MagnifyingGlass, X } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSection, MetricPair } from '@/components/finance';
import { Empty, IconButton, Input, Tabs, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { layoutTokens } from '@/lib/theme/tokens';

export default function ActivityScreen() {
  const [filter, setFilter] = useState('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: layoutTokens.sectionGap,
        gap: 32,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {searching ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Input
            accessibilityLabel="Search transactions"
            autoFocus
            placeholder="Merchant, category, amount..."
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1 }}
          />
          <IconButton
            label="Close search"
            variant="ghost"
            onPress={() => {
              setQuery('');
              setSearching(false);
            }}
          >
            <X size={20} color={tokens.foreground} />
          </IconButton>
        </View>
      ) : (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="title">Activity</Typography>
          <IconButton label="Search activity" variant="ghost" onPress={() => setSearching(true)}>
            <MagnifyingGlass size={21} color={tokens.foreground} />
          </IconButton>
        </View>
      )}

      <View style={{ gap: 12 }}>
        <Typography variant="label">This month</Typography>
        <MetricPair
          left={{ label: 'Spent', value: '₹0' }}
          right={{ label: 'Income', value: '₹0' }}
        />
      </View>

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { label: 'All', value: 'all' },
          { label: 'Expenses', value: 'expenses' },
          { label: 'Income', value: 'income' },
          { label: 'Splits', value: 'splits' },
        ]}
      />

      <DateSection title={query ? 'Search results' : 'Today'}>
        <Empty
          title={
            query ? 'No matching activity.' : `No ${filter === 'all' ? 'activity' : filter} yet.`
          }
          description={
            query
              ? 'Try a merchant, category, account, or amount.'
              : 'Transactions, group expenses, and settlements will appear here.'
          }
        />
      </DateSection>
    </ScrollView>
  );
}
