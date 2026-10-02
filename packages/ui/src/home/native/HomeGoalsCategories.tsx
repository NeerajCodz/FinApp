import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Wallet } from '@finapp/ui/icons/native';
import { Button, Card, SectionHeader, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import { CategoryIcon } from '@finapp/ui/finance';
import type { HomeDashboardData } from '../model';

export function HomeGoalsCategories({
  data,
  currency,
  onOpenGoal,
  onSeeAllGoals,
  onOpenCategory,
  onSeeAllCategories,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenGoal: (id: string) => void;
  onSeeAllGoals: () => void;
  onOpenCategory: (id: string) => void;
  onSeeAllCategories: () => void;
}) {
  const { tokens } = useTheme();
  const maxCategory = data.categories.reduce(
    (maximum, category) => Math.max(maximum, Number(category.amountMinor)),
    0,
  );
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 5 }}>
        <SectionHeader
          title="Savings & goals"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllGoals}>
              See all
            </Button>
          }
        />
        {data.goals.length ? (
          data.goals.map((goal) => {
            const progress =
              goal.targetMinor > 0n
                ? Math.min(100, Number((goal.savedMinor * 100n) / goal.targetMinor))
                : 0;
            return (
              <TouchableOpacity
                key={goal.id}
                accessibilityRole="button"
                onPress={() => onOpenGoal(goal.id)}
                activeOpacity={0.75}
                style={{
                  minHeight: 62,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 6,
                }}
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
                  <Wallet size={17} color={tokens.primary} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    <Typography variant="bodyLarge" numberOfLines={1} style={{ flex: 1 }}>
                      {goal.name}
                    </Typography>
                    <Typography variant="caption">{Math.round(progress)}%</Typography>
                  </View>
                  <View
                    style={{
                      height: 5,
                      borderRadius: 4,
                      backgroundColor: tokens.surfaceSubtle,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: tokens.primary,
                      }}
                    />
                  </View>
                  <Typography variant="caption">
                    {formatMinor(goal.savedMinor, goal.currency || currency)} of{' '}
                    {formatMinor(goal.targetMinor, goal.currency || currency)}
                  </Typography>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 10, gap: 7 }}>
            <Text style={{ color: tokens.foregroundMuted }}>No active savings goals yet.</Text>
            <Button size="sm" variant="outline" onPress={onSeeAllGoals}>
              Create a goal
            </Button>
          </View>
        )}
      </Card>
      <Card style={{ gap: 5 }}>
        <SectionHeader
          title="Spend by category"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllCategories}>
              See all
            </Button>
          }
        />
        {data.categories.length ? (
          data.categories.map((category) => {
            const percent = maxCategory ? (Number(category.amountMinor) / maxCategory) * 100 : 0;
            return (
              <TouchableOpacity
                key={category.id}
                accessibilityRole="button"
                onPress={() => onOpenCategory(category.id)}
                activeOpacity={0.75}
                style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <CategoryIcon label={category.name} icon={category.icon} />
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    <Typography variant="bodyLarge" numberOfLines={1} style={{ flex: 1 }}>
                      {category.name}
                    </Typography>
                    <Typography variant="small" numberOfLines={1}>
                      {formatMinor(category.amountMinor, currency)}
                    </Typography>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 4,
                      backgroundColor: tokens.surfaceSubtle,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: tokens.primary,
                      }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 10, gap: 7 }}>
            <Text style={{ color: tokens.foregroundMuted }}>
              No spending recorded in this period.
            </Text>
            <Button size="sm" variant="outline" onPress={onSeeAllCategories}>
              Browse categories
            </Button>
          </View>
        )}
      </Card>
    </View>
  );
}
