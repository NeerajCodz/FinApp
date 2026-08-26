import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, ChartLineUp, Plus, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart } from '@/components/charts/BarChart';
import {
  Button,
  Card,
  IconButton,
  Progress,
  SectionHeader,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <Card variant="outline" style={{ flex: 1, gap: 12, minHeight: 122 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>{label}</Text>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: `${tone}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      </View>
      <Typography variant="heading" style={{ fontSize: 21, fontVariant: ['tabular-nums'] }}>
        {value}
      </Typography>
      <Typography variant="caption">No entries yet</Typography>
    </Card>
  );
}

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const loading = false;
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: tokens.background, padding: 20, gap: 16 }} />;
  }
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 28,
        gap: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 5 }}>
          <Typography variant="label">Overview</Typography>
          <Typography variant="title">Good morning</Typography>
        </View>
        <IconButton
          label="Open wallet"
          variant="outline"
          onPress={() => router.push('/account' as never)}
        >
          <Wallet size={21} color={tokens.foreground} weight="regular" />
        </IconButton>
      </View>

      <Card style={{ backgroundColor: tokens.foreground, padding: 22, gap: 18 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ color: tokens.background, opacity: 0.62, fontSize: 12 }}>
            Available balance
          </Text>
          <ChartLineUp size={21} color={tokens.background} weight="bold" />
        </View>
        <Typography
          variant="display"
          style={{ color: tokens.background, fontVariant: ['tabular-nums'] }}
        >
          ₹0.00
        </Typography>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Text style={{ color: tokens.background, opacity: 0.62, fontSize: 12 }}>
            Across all accounts
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => router.push('/account/new' as never)}
          >
            <Plus size={15} color={tokens.secondaryForeground} weight="bold" />
            <Text
              style={{
                color: tokens.secondaryForeground,
                marginLeft: 6,
                fontFamily: 'PlusJakartaSans_600SemiBold',
                fontSize: 12,
              }}
            >
              Add account
            </Text>
          </Button>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat
          label="Income"
          value="₹0"
          tone={tokens.income}
          icon={<ArrowUpRight size={16} color={tokens.income} weight="bold" />}
        />
        <Stat
          label="Spending"
          value="₹0"
          tone={tokens.expense}
          icon={<ArrowDownRight size={16} color={tokens.expense} weight="bold" />}
        />
      </View>

      <Card variant="outline" style={{ gap: 18 }}>
        <SectionHeader
          title="Spending overview"
          action={<Typography variant="caption">This month</Typography>}
        />
        <BarChart values={[0, 0, 0, 0, 0, 0, 0]} />
        <Typography variant="caption">
          Add transactions to see your rhythm across the month.
        </Typography>
      </Card>

      <Card variant="subtle" style={{ gap: 14 }}>
        <SectionHeader title="Budget progress" />
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Typography variant="heading">No active budgets</Typography>
          <Typography variant="caption">0%</Typography>
        </View>
        <Progress value={0} />
        <Button variant="outline" size="sm" onPress={() => router.push('/budget/new' as never)}>
          Create a budget
        </Button>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeader
          title="Recent activity"
          action={
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(tabs)/activity' as never)}
            >
              View all
            </Button>
          }
        />
        <Card variant="outline" style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <Typography variant="heading">Your ledger starts here</Typography>
          <Typography variant="caption" style={{ textAlign: 'center' }}>
            Track an expense or income and your first signal will appear here.
          </Typography>
          <Button size="sm" onPress={() => router.push('/transaction/new' as never)}>
            <Plus size={15} color={tokens.primaryForeground} weight="bold" />
            <Text
              style={{
                color: tokens.primaryForeground,
                marginLeft: 6,
                fontFamily: 'PlusJakartaSans_600SemiBold',
                fontSize: 12,
              }}
            >
              Add transaction
            </Text>
          </Button>
        </Card>
      </View>
    </ScrollView>
  );
}
