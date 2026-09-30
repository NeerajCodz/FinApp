import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CalendarDays, UsersThree } from '@finapp/ui/icons/native';
import { Button, Card, SectionHeader, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { HomeDashboardData } from '../model';

export function HomeGroupsBills({
  data,
  currency,
  onOpenGroup,
  onSeeAllGroups,
  onSeeAllBills,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenGroup: (id: string) => void;
  onSeeAllGroups: () => void;
  onSeeAllBills: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 5 }}>
        <SectionHeader
          title="Groups"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllGroups}>
              See all
            </Button>
          }
        />
        {data.groups.length ? (
          data.groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              accessibilityRole="button"
              onPress={() => onOpenGroup(group.id)}
              activeOpacity={0.75}
              style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <UsersThree size={17} color={tokens.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="bodyLarge" numberOfLines={1}>
                  {group.name}
                </Typography>
                <Typography variant="caption">
                  {group.memberCount} members ·{' '}
                  {formatMinor(group.spentMinor, group.currency || currency)} spent
                </Typography>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 10, gap: 7 }}>
            <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
              No shared groups yet.
            </Text>
            <Button size="sm" variant="outline" onPress={onSeeAllGroups}>
              Create a group
            </Button>
          </View>
        )}
      </Card>
      <Card style={{ gap: 5 }}>
        <SectionHeader
          title="Recurring & bills"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllBills}>
              See all
            </Button>
          }
        />
        {data.upcomingBills.length ? (
          data.upcomingBills.map((bill) => (
            <View
              key={bill.id}
              style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View
                style={{
                  width: 35,
                  height: 35,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 11,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <CalendarDays size={16} color={tokens.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="bodyLarge" numberOfLines={1}>
                  {bill.name}
                </Typography>
                <Typography variant="caption">
                  Due{' '}
                  {new Date(bill.nextOccurrence).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Typography>
              </View>
              <Typography variant="small" numberOfLines={1}>
                {formatMinor(bill.amountMinor, bill.currency || currency)}
              </Typography>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 10, gap: 7 }}>
            <Text style={{ color: tokens.foregroundMuted }}>No bills due in the next 30 days.</Text>
            <Button size="sm" variant="outline" onPress={onSeeAllBills}>
              Manage recurring
            </Button>
          </View>
        )}
      </Card>
    </View>
  );
}
