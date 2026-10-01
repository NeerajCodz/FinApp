import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ChartLineUp } from '@finapp/ui/icons/native';
import { Button, IconButton, Input, Progress, Typography, useTheme } from '@finapp/ui/native';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';
import { Money } from './Money';
import type { GoalOverviewItem } from './GoalsOverviewScreen';

export type GoalHistoryItem = { id: string; occurredAt: number; amount: bigint };
export type GoalDetailScreenProps = {
  goal: GoalOverviewItem;
  available: boolean;
  history: readonly GoalHistoryItem[];
  loading: boolean;
  error?: string;
  actionError?: string;
  saving: boolean;
  onContribute: (amount: string) => void;
  onIconChange: (icon?: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onEdit: () => void;
  onAnalytics: () => void;
};

export function GoalDetailScreen({
  goal,
  available,
  history,
  loading,
  error,
  actionError,
  saving,
  onContribute,
  onIconChange,
  onBack,
  onRetry,
  onEdit,
  onAnalytics,
}: GoalDetailScreenProps) {
  const { tokens } = useTheme();
  const [amount, setAmount] = React.useState('');
  let dateLabel = 'No target date set';
  if (goal.percent >= 100) dateLabel = 'Target reached';
  else if (goal.targetDate)
    dateLabel =
      goal.targetDate < Date.now()
        ? `Target date passed · ${new Date(goal.targetDate).toLocaleDateString()}`
        : `Target date · ${new Date(goal.targetDate).toLocaleDateString()}`;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 32, gap: 18 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton label="Back to goals" variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} color={tokens.foreground} />
        </IconButton>
        {available && (
          <>
            <Button variant="outline" onPress={onAnalytics}>
              <ChartLineUp size={16} color={tokens.foreground} /> Analytics
            </Button>
            <Button variant="outline" onPress={onEdit}>
              Edit
            </Button>
          </>
        )}
      </View>
      {loading ? (
        <Typography variant="small">Loading goal…</Typography>
      ) : error ? (
        <View accessibilityRole="alert" style={{ gap: 10 }}>
          <Text style={{ color: tokens.destructive }}>{error}</Text>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </View>
      ) : !available ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 80 }}>
          <Typography variant="heading">Goal unavailable</Typography>
          <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
            It may have been archived or is not saved on this device.
          </Text>
        </View>
      ) : (
        <>
          {actionError && (
            <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {actionError}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: goal.color ?? tokens.surfaceRaised,
              }}
            >
              <EntityIcon value={goal.icon ?? 'lucide:Target'} size={22} color={tokens.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="heading">{goal.name}</Typography>
              <Text style={{ color: tokens.foregroundMuted }}>{dateLabel}</Text>
            </View>
            <EntityIconPicker
              mode="all"
              value={goal.icon}
              onChange={onIconChange}
              label="Change goal icon"
            />
          </View>
          <View
            accessibilityLabel="Goal progress"
            style={{
              gap: 10,
              padding: 18,
              borderRadius: 20,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Typography variant="label">Saved so far</Typography>
            <Money amountMinor={goal.saved} currency={goal.currency} size="display" />
            <Text style={{ color: tokens.foregroundMuted }}>
              of <Money amountMinor={goal.target} currency={goal.currency} /> target
            </Text>
            <Progress
              value={Math.min(100, Math.max(0, goal.percent))}
              color={goal.color ?? tokens.primary}
            />
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Typography variant="caption">{goal.percent}% reached</Typography>
              <Typography variant="caption">{dateLabel}</Typography>
            </View>
            {goal.target > goal.saved && (
              <Text style={{ color: tokens.foregroundMuted }}>
                <Money amountMinor={goal.target - goal.saved} currency={goal.currency} /> left to
                reach your target
              </Text>
            )}
          </View>
          <View
            style={{ gap: 12, paddingTop: 18, borderTopWidth: 1, borderColor: tokens.borderSubtle }}
          >
            <Typography variant="heading">Record a contribution</Typography>
            <Text style={{ color: tokens.foregroundMuted }}>
              This tracks progress; it does not move money between accounts.
            </Text>
            <Input
              accessibilityLabel={`Amount in ${goal.currency}`}
              placeholder={`Amount · ${goal.currency}`}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Button disabled={saving || !amount.trim()} onPress={() => onContribute(amount)}>
              {saving ? 'Saving…' : 'Add contribution'}
            </Button>
          </View>
          <View style={{ gap: 10 }}>
            <Typography variant="heading">Contribution history</Typography>
            {history.length === 0 ? (
              <Text style={{ color: tokens.foregroundMuted }}>No contributions recorded yet.</Text>
            ) : (
              history.map((entry) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderColor: tokens.borderSubtle,
                  }}
                >
                  <Typography variant="small">
                    {new Date(entry.occurredAt).toLocaleDateString()}
                  </Typography>
                  <Money amountMinor={entry.amount} currency={goal.currency} />
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
