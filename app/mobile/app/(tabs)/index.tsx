import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpendingLineChart } from '@/components/charts/BarChart';
import { BalanceHero, MetricPair } from '@/components/finance';
import {
  Avatar,
  Button,
  Progress,
  SectionHeader,
  Separator,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const currentMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date());

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 124,
        gap: 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="small" style={{ color: tokens.foreground }}>
          Good evening
        </Typography>
        <Avatar initials="NS" label="Open profile" size={38} />
      </View>

      <BalanceHero amountMinor={0n} currency="INR" />

      <MetricPair left={{ label: 'Income', value: '₹0' }} right={{ label: 'Spent', value: '₹0' }} />

      <View style={{ gap: 20 }}>
        <SectionHeader
          title="Spending"
          action={<Typography variant="small">{currentMonth}</Typography>}
        />
        <SpendingLineChart values={[0, 0, 0, 0, 0, 0, 0, 0]} />
      </View>

      <View style={{ gap: 16 }}>
        <SectionHeader title="You can spend" />
        <View style={{ gap: 6 }}>
          <Typography variant="display" style={{ fontVariant: ['tabular-nums'] }}>
            ₹0
          </Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Set a monthly budget to see what is safe to spend.
          </Text>
        </View>
        <Progress value={0} color={tokens.primary} />
        <Button
          variant="ghost"
          onPress={() => router.push('/budget/new' as never)}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        >
          Set budget
        </Button>
      </View>

      <Separator />

      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Accounts"
          action={
            <Button variant="ghost" size="sm" onPress={() => router.push('/account' as never)}>
              See all
            </Button>
          }
        />
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
          Add an account to bring balances and activity into focus.
        </Text>
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.push('/account/new' as never)}
          style={{ alignSelf: 'flex-start' }}
        >
          Add account
        </Button>
      </View>

      <Separator />

      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Recent"
          action={
            <Button variant="ghost" size="sm" onPress={() => router.push('/(tabs)/activity')}>
              All
            </Button>
          }
        />
        <Typography variant="heading">No activity yet.</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 280 }}>
          Your latest expenses, income, and settlements will appear here.
        </Text>
      </View>
    </ScrollView>
  );
}
