import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowsLeftRight, ArrowUpRight, MagnifyingGlass, Plus } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Card, IconButton, Input, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function ActivityScreen() {
  const [filter, setFilter] = useState('All');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const filters = ['All', 'Income', 'Spending'];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 28, gap: 22 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 5 }}><Typography variant="label">Ledger</Typography><Typography variant="title">Activity</Typography></View>
        <IconButton label="Search activity" variant="outline"><MagnifyingGlass size={20} color={tokens.foreground} /></IconButton>
      </View>
      <View style={{ gap: 10 }}>
        <Input accessibilityLabel="Search activity" placeholder="Search merchant, note, or amount" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {filters.map((item) => <Button key={item} size="sm" variant={filter === item ? 'primary' : 'outline'} onPress={() => setFilter(item)}>{item}</Button>)}
        </View>
      </View>
      <Card variant="subtle" style={{ gap: 15 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>This month</Text><ArrowsLeftRight size={18} color={tokens.mutedForeground} /></View>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ gap: 4 }}><Typography variant="heading">₹0</Typography><Typography variant="caption">Income</Typography></View>
          <View style={{ gap: 4 }}><Typography variant="heading">₹0</Typography><Typography variant="caption">Spending</Typography></View>
        </View>
      </Card>
      <Card variant="outline" style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${tokens.primary}22`, alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={23} color={tokens.primary} weight="bold" /></View>
        <Typography variant="heading">No {filter.toLowerCase()} yet</Typography>
        <Text style={{ color: tokens.mutedForeground, textAlign: 'center', lineHeight: 20 }}>Transactions, group expenses, and settlements will appear here.</Text>
        <Button size="sm" onPress={() => router.push('/transaction/new' as never)}><Plus size={15} color={tokens.primaryForeground} weight="bold" /><Text style={{ color: tokens.primaryForeground, marginLeft: 6, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 }}>Add expense</Text></Button>
      </Card>
    </ScrollView>
  );
}
