import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon, Money } from '@/components/finance';
import { Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const label = id ?? 'Category';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 36,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <CategoryIcon label={label} />
        <Typography variant="heading">{label}</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">This month</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
      </View>
      <Empty
        title="No transactions."
        description="Historical transactions in this category will appear here."
      />
    </ScrollView>
  );
}
