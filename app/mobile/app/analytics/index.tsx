import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { InsightBars, SpendingLineChart } from '@/components/charts/BarChart';
import { Money } from '@/components/finance';
import { IconButton, SectionHeader, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState('month');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 64,
        gap: 36,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Analytics</Typography>
      </View>

      <Tabs
        value={period}
        onChange={setPeriod}
        tabs={[
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
          { label: 'Year', value: 'year' },
        ]}
      />

      <View style={{ gap: 10 }}>
        <Typography variant="display">Your spending,{`\n`}in focus.</Typography>
        <View style={{ gap: 4, marginTop: 8 }}>
          <Typography variant="label">Spent</Typography>
          <Money amountMinor={0n} currency="INR" size="display" />
          <Typography variant="caption">No comparison available yet</Typography>
        </View>
      </View>

      <SpendingLineChart values={[0, 0, 0, 0, 0, 0, 0, 0]} />

      <View style={{ gap: 20 }}>
        <SectionHeader title="Where it went" />
        <InsightBars
          items={[
            { label: 'Food', value: 0, amount: '₹0', color: tokens.chart.volt },
            { label: 'Transport', value: 0, amount: '₹0', color: tokens.chart.blue },
            { label: 'Shopping', value: 0, amount: '₹0', color: tokens.chart.violet },
          ]}
        />
        <Typography variant="caption">Categories appear after your first few entries.</Typography>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Patterns" />
        <Typography variant="heading">Nothing to call out yet.</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
          Finapp will surface useful changes without filling this screen with noise.
        </Text>
      </View>
    </ScrollView>
  );
}
