import React from 'react';
import { View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, ChartLineUp, Wallet } from '@finapp/ui/icons/native';
import { Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { HomeDashboardData } from '../model';

export function HomeMetrics({ data, currency }: { data: HomeDashboardData; currency: string }) {
  const { tokens } = useTheme();
  const items = [
    {
      label: 'Total balance',
      amount: data.balanceMinor,
      note: 'Selected accounts',
      icon: Wallet,
      tint: tokens.primary,
    },
    {
      label: 'Spent this period',
      amount: data.spentMinor,
      note: 'Posted expenses',
      icon: ArrowDownRight,
      tint: tokens.expense,
    },
    {
      label: 'Income this period',
      amount: data.incomeMinor,
      note: 'Posted income',
      icon: ArrowUpRight,
      tint: tokens.income,
    },
    {
      label: 'Net cash flow',
      amount: data.netMinor,
      note: 'Income less spending',
      icon: ChartLineUp,
      tint: tokens.foreground,
    },
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(({ label, amount, note, icon: Icon, tint }) => (
          <View
            key={label}
            style={{
              width: '48.5%',
              minHeight: 108,
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 16,
              padding: 13,
              backgroundColor: tokens.card,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 4,
              }}
            >
              <Typography variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {label}
              </Typography>
              <Icon size={16} color={tint} />
            </View>
            <Typography
              variant="heading"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontSize: 18, letterSpacing: -0.6 }}
            >
              {formatMinor(amount, currency)}
            </Typography>
            <Typography variant="caption" numberOfLines={1}>
              {note}
            </Typography>
          </View>
        ))}
      </View>
      <View
        style={{
          minHeight: 84,
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 16,
          padding: 14,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        <Typography variant="caption">
          UPCOMING BILLS · {data.upcomingBillsCount} DUE IN 30 DAYS
        </Typography>
        <Typography variant="heading" style={{ fontSize: 20, color: tokens.primary }}>
          {formatMinor(data.upcomingBillsMinor, currency)}
        </Typography>
      </View>
    </View>
  );
}
