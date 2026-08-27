import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CalendarDays, Car, ShoppingBag, Utensils, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpendingLineChart } from '@/components/charts/BarChart';
import { BalanceHero, GroupCard, MetricPair, PeopleRail } from '@/components/finance';
import {
  Button,
  IconButton,
  Progress,
  SectionHeader,
  Separator,
  Sheet,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const currentMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date());
const categories = [
  { label: 'Food', icon: Utensils, color: '#B7FF4A' },
  { label: 'Transport', icon: Car, color: '#5B8CFF' },
  { label: 'Shopping', icon: ShoppingBag, color: '#9D7BFF' },
  { label: 'Bills', icon: Wallet, color: '#FF9A51' },
];

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useQuery(api.groups.queries.list);
  const [period, setPeriod] = useState('This month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const periodOptions = useMemo(() => ['Today', 'This week', 'This month', 'Custom date'], []);
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 180,
          gap: 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="small" style={{ color: tokens.foreground }}>
            Good evening
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(tabs)/profile')}
            style={{ paddingHorizontal: 0 }}
          >
            NS
          </Button>
        </View>

        <BalanceHero amountMinor={0n} currency="INR" delta="Your money, back in focus." />

        <MetricPair
          left={{ label: 'Income', value: '₹0' }}
          right={{ label: 'Spent', value: '₹0' }}
        />

        <View style={{ gap: 18 }}>
          <SectionHeader
            title="Spending"
            action={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Button variant="ghost" size="sm" onPress={() => setPeriodOpen(true)}>
                  {period}
                </Button>
                <IconButton label="Choose date" variant="ghost" onPress={() => setPeriodOpen(true)}>
                  <CalendarDays size={19} color={tokens.foreground} />
                </IconButton>
              </View>
            }
          />
          <SpendingLineChart values={[0, 0, 0, 0, 0, 0, 0, 0]} />
        </View>

        <View style={{ gap: 16 }}>
          <SectionHeader
            title="Categories"
            action={<Typography variant="caption">{period}</Typography>}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {categories.map(({ label, icon: Icon, color }) => (
              <Button
                key={label}
                variant="ghost"
                onPress={() => router.push('/category' as never)}
                style={{
                  width: '48%',
                  minHeight: 76,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.borderSubtle,
                  backgroundColor: tokens.surfaceSubtle,
                  justifyContent: 'flex-start',
                  paddingHorizontal: 14,
                }}
              >
                <View style={{ gap: 8 }}>
                  <Icon size={19} color={color} />
                  <Typography variant="small" style={{ color: tokens.foreground }}>
                    {label}
                  </Typography>
                </View>
              </Button>
            ))}
          </View>
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
        <PeopleRail onSelect={() => router.push('/group/new' as never)} />

        <View style={{ gap: 14 }}>
          <SectionHeader
            title="Groups"
            action={
              <Button variant="ghost" size="sm" onPress={() => router.push('/(tabs)/groups')}>
                See all
              </Button>
            }
          />
          {groups && groups.length > 0 ? (
            groups
              .slice(0, 2)
              .map((group) => (
                <GroupCard
                  key={group._id}
                  name={group.name}
                  meta={group.currency}
                  balance="₹0"
                  meaning="All settled"
                  onPress={() => router.push(`/group/${group._id}` as never)}
                />
              ))
          ) : (
            <Text style={{ color: tokens.foregroundMuted }}>
              Create a group to split money with people you know.
            </Text>
          )}
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

      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title="Spending period">
        <View style={{ gap: 8 }}>
          {periodOptions.map((option) => (
            <Button
              key={option}
              variant={period === option ? 'secondary' : 'ghost'}
              onPress={() => {
                setPeriod(option);
                if (option !== 'Custom date') setPeriodOpen(false);
              }}
              style={{ justifyContent: 'flex-start', minHeight: 54 }}
            >
              {option}
            </Button>
          ))}
          {period === 'Custom date' && (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={{ color: tokens.foregroundMuted }}>Pick a date range or month.</Text>
              <Input
                accessibilityLabel="Custom date"
                placeholder="27 Aug 2026"
                value={customDate}
                onChangeText={setCustomDate}
              />
              <Button size="lg" disabled={!customDate.trim()} onPress={() => setPeriodOpen(false)}>
                Apply date
              </Button>
            </View>
          )}
        </View>
      </Sheet>
    </>
  );
}
