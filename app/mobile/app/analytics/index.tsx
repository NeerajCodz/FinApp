import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ChartLineUp, TrendDown, TrendUp } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart, InsightBars } from '@/components/charts/BarChart';
import { Button, Card, IconButton, SectionHeader, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState('Month');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 30, gap: 22 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
        <View style={{ gap: 4 }}><Typography variant="label">Signals</Typography><Typography variant="title">Analytics</Typography></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['Week', 'Month', 'Year'].map((item) => <Button key={item} size="sm" variant={period === item ? 'primary' : 'outline'} onPress={() => setPeriod(item)}>{item}</Button>)}
      </View>
      <Card style={{ backgroundColor: tokens.foreground, gap: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: tokens.background, opacity: 0.64, fontSize: 12 }}>Spending trend</Text><ChartLineUp size={20} color={tokens.background} weight="bold" /></View>
        <Typography variant="display" style={{ color: tokens.background, fontVariant: ['tabular-nums'] }}>₹0</Typography>
        <Text style={{ color: tokens.background, opacity: 0.64, fontSize: 12 }}>No spending recorded this {period.toLowerCase()}</Text>
        <BarChart values={[0, 0, 0, 0, 0, 0, 0]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} />
      </Card>
      <Card variant="outline" style={{ gap: 18 }}>
        <SectionHeader title="Where it goes" />
        <InsightBars items={[{ label: 'Essentials', value: 0, amount: '₹0' }, { label: 'Lifestyle', value: 0, amount: '₹0' }, { label: 'Transfers', value: 0, amount: '₹0' }]} />
        <Typography variant="caption">Categories become useful once your ledger has a few entries.</Typography>
      </Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card variant="subtle" style={{ flex: 1, gap: 9 }}><TrendUp size={19} color={tokens.income} weight="bold" /><Typography variant="heading">Income</Typography><Typography variant="caption">₹0 recorded</Typography></Card>
        <Card variant="subtle" style={{ flex: 1, gap: 9 }}><TrendDown size={19} color={tokens.expense} weight="bold" /><Typography variant="heading">Outflow</Typography><Typography variant="caption">₹0 recorded</Typography></Card>
      </View>
    </ScrollView>
  );
}
