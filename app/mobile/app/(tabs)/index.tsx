import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CalendarDays } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpendingLineChart } from '@/components/charts/BarChart';
import {
  BalanceHero,
  CategoryIcon,
  MetricPair,
  PeopleRail,
  SettingsRow,
  TransactionRow,
} from '@/components/finance';
import {
  Button,
  Empty,
  IconButton,
  Input,
  SectionHeader,
  Separator,
  Sheet,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { layoutTokens } from '@/lib/theme/tokens';
import { formatMinor } from '@/lib/money';

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useQuery(api.groups.queries.list);
  const accounts = useQuery(api.accounts.queries.list);
  const categories = useQuery(api.categories.queries.list);
  const profile = useQuery(api.users.queries.current);
  const [period, setPeriod] = useState('This month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [appliedDate, setAppliedDate] = useState<Date | null>(null);
  const [dateError, setDateError] = useState('');
  const periodOptions = ['Today', 'This week', 'This month', 'Custom date'];
  const range = useMemo(() => {
    const today = new Date();
    const start = period === 'Custom date' && appliedDate ? new Date(appliedDate) : new Date(today);
    if (period === 'This week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (period === 'This month' || (period === 'Custom date' && !appliedDate)) start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (period === 'This week') end.setDate(end.getDate() + 7);
    else if (period === 'This month' || (period === 'Custom date' && !appliedDate))
      end.setMonth(end.getMonth() + 1);
    else end.setDate(end.getDate() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [period, appliedDate]);
  const summary = useQuery(api.dashboard.queries.summary, range);
  const currency = profile?.defaultCurrency ?? 'INR';
  const balanceMinor =
    accounts
      ?.filter((account) => account.currency === currency)
      .reduce((total, account) => total + account.balanceMinor, 0n) ?? 0n;
  const displayName = profile?.displayName ?? profile?.name ?? '';
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: layoutTokens.sectionGap,
          gap: 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="small" style={{ color: tokens.foreground }}>
            {new Date().getHours() < 12
              ? 'Good morning'
              : new Date().getHours() < 17
                ? 'Good afternoon'
                : 'Good evening'}
            {displayName ? `, ${displayName}` : ''}
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(tabs)/profile')}
            style={{ paddingHorizontal: 0 }}
          >
            {displayName ? displayName.slice(0, 2).toUpperCase() : 'Profile'}
          </Button>
        </View>

        <BalanceHero amountMinor={balanceMinor} currency={currency} />
        <MetricPair
          left={{ label: 'Income', value: formatMinor(summary?.incomeMinor ?? 0n, currency) }}
          right={{ label: 'Spent', value: formatMinor(summary?.spentMinor ?? 0n, currency) }}
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
          {summary ? (
            <SpendingLineChart
              values={summary.chart}
              labels={[
                new Date(range.startAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                }),
                new Date(range.endAt - 1).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                }),
              ]}
            />
          ) : (
            <Typography variant="small">Loading spending…</Typography>
          )}
        </View>

        <View style={{ gap: 16 }}>
          <SectionHeader
            title="Categories"
            action={
              <Button variant="ghost" size="sm" onPress={() => router.push('/category' as never)}>
                See all
              </Button>
            }
          />
          {categories === undefined ? (
            <Typography variant="small">Loading categories…</Typography>
          ) : categories.length === 0 ? (
            <Empty
              title="No categories yet."
              description="Create a category to organize transactions."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/category/new' as never)}
                >
                  Add category
                </Button>
              }
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {categories.slice(0, 4).map((category) => (
                <Button
                  key={category._id}
                  variant="ghost"
                  onPress={() => router.push(`/category/${category._id}` as never)}
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
                    <CategoryIcon label={category.name} />
                    <Typography variant="small" style={{ color: tokens.foreground }}>
                      {category.name}
                    </Typography>
                  </View>
                </Button>
              ))}
            </View>
          )}
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
          {groups === undefined ? (
            <Typography variant="small">Loading groups…</Typography>
          ) : groups.length > 0 ? (
            groups
              .slice(0, 2)
              .map((group) => (
                <SettingsRow
                  key={group._id}
                  label={group.name}
                  value={group.currency}
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
          {summary === undefined ? (
            <Typography variant="small">Loading activity…</Typography>
          ) : summary?.recent.length ? (
            summary.recent.map((transaction) => (
              <TransactionRow
                key={transaction._id}
                title={transaction.title}
                category={
                  categories?.find((category) => category._id === transaction.categoryId)?.name
                }
                amountMinor={transaction.amountMinor}
                currency={transaction.currency}
                type={transaction.type}
                date={new Date(transaction.occurredAt).toLocaleDateString()}
                onPress={() => router.push(`/transaction/${transaction._id}` as never)}
              />
            ))
          ) : (
            <Text style={{ color: tokens.foregroundMuted }}>
              Your latest transactions will appear here.
            </Text>
          )}
        </View>
      </ScrollView>

      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title="Spending period">
        <View style={{ gap: 8 }}>
          {periodOptions.map((option) => (
            <Button
              key={option}
              variant={period === option ? 'primary' : 'ghost'}
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
              <Text style={{ color: tokens.foregroundMuted }}>
                Show spending for one date (YYYY-MM-DD).
              </Text>
              <Input
                accessibilityLabel="Custom date"
                placeholder="2026-08-27"
                value={customDate}
                onChangeText={setCustomDate}
              />
              {!!dateError && (
                <Typography style={{ color: tokens.expense }}>{dateError}</Typography>
              )}
              <Button
                size="lg"
                disabled={!customDate.trim()}
                onPress={() => {
                  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(customDate.trim());
                  const selected = match
                    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
                    : null;
                  if (
                    !selected ||
                    selected.getFullYear() !== Number(match?.[1]) ||
                    selected.getMonth() + 1 !== Number(match?.[2]) ||
                    selected.getDate() !== Number(match?.[3])
                  ) {
                    setDateError('Enter a valid date as YYYY-MM-DD.');
                    return;
                  }
                  setAppliedDate(selected);
                  setDateError('');
                  setPeriodOpen(false);
                }}
              >
                Apply date
              </Button>
            </View>
          )}
        </View>
      </Sheet>
    </>
  );
}
