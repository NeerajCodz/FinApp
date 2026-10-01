import { ScrollView, TouchableOpacity, View } from 'react-native';
import { CaretRight, Plus, Wallet } from '@finapp/ui/icons/native';
import { Button, IconButton, Progress, Text, Typography, useTheme } from '@finapp/ui/native';
import { EntityIcon } from './EntityIconPicker';
import { Money } from './Money';
import type { GoalOverviewItem, GoalsOverviewScreenProps } from '../web/GoalsOverviewScreen';

export type { GoalOverviewItem, GoalsOverviewScreenProps } from '../web/GoalsOverviewScreen';

export function GoalsOverviewScreen({
  goals,
  totalSaved,
  currencyCount,
  loading,
  error,
  connected,
  defaultCurrency,
  onAdd,
  onOpen,
  onRetry,
  onSetCurrency,
}: GoalsOverviewScreenProps) {
  const { tokens } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 12,
        paddingBottom: 32,
        gap: 24,
        flexGrow: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Typography variant="title" style={{ flex: 1 }}>
          Goals
        </Typography>
        {!loading && defaultCurrency && (
          <IconButton label="Add goal" variant="ghost" onPress={onAdd}>
            <Plus size={21} color={tokens.foreground} />
          </IconButton>
        )}
      </View>
      {!loading && goals.length > 0 && (
        <View style={{ gap: 8 }}>
          <Typography variant="label">
            Saved toward {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
          </Typography>
          {totalSaved !== null ? (
            <Money
              amountMinor={totalSaved}
              currency={goals[0]?.currency ?? defaultCurrency ?? 'INR'}
              size="display"
            />
          ) : (
            <Typography variant="heading">Across {currencyCount} currencies</Typography>
          )}
          <Text style={{ color: tokens.foregroundMuted }}>
            Contributions are recorded separately from account balances.
          </Text>
        </View>
      )}
      {error && (
        <View style={{ gap: 10 }} accessibilityRole="alert">
          <Text style={{ color: tokens.destructive }}>Saved goals could not be loaded.</Text>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </View>
      )}
      {loading && !error && <Typography variant="small">Loading saved goals…</Typography>}
      {!loading && !error && goals.length === 0 && (
        <View
          style={{
            flex: 1,
            minHeight: 300,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 24,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={32} color={tokens.primary} />
          </View>
          <Typography variant="heading" style={{ textAlign: 'center' }}>
            No goals yet
          </Typography>
          <Text style={{ color: tokens.foregroundMuted, textAlign: 'center', maxWidth: 280 }}>
            Set a target and track each contribution in one place.
          </Text>
          {defaultCurrency ? (
            <Button onPress={onAdd}>Create a goal</Button>
          ) : (
            <>
              <Typography variant="small">
                Choose a default currency before creating a goal.
              </Typography>
              <Button variant="outline" onPress={onSetCurrency}>
                Set default currency
              </Button>
            </>
          )}
          {!connected && <Typography variant="small">Offline · showing saved goals</Typography>}
        </View>
      )}
      {!loading && !error && goals.length > 0 && (
        <View style={{ gap: 6 }}>
          <Typography variant="label">Your goals</Typography>
          {goals.map((goal: GoalOverviewItem) => {
            const dateLabel =
              goal.percent >= 100
                ? 'Target reached'
                : goal.targetDate
                  ? goal.targetDate < Date.now()
                    ? `Target date passed · ${new Date(goal.targetDate).toLocaleDateString()}`
                    : `Target · ${new Date(goal.targetDate).toLocaleDateString()}`
                  : 'No target date';
            return (
              <TouchableOpacity
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`${goal.name}, ${goal.percent}% of target saved`}
                onPress={() => onOpen(goal.id)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 18,
                  gap: 10,
                  borderBottomWidth: 1,
                  borderColor: tokens.borderSubtle,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: goal.color ?? tokens.surfaceRaised,
                    }}
                  >
                    <EntityIcon
                      value={goal.icon ?? 'lucide:Target'}
                      size={22}
                      color={tokens.primary}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Typography variant="bodyLarge" numberOfLines={1}>
                      {goal.name}
                    </Typography>
                    <Typography variant="small">{dateLabel}</Typography>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Money amountMinor={goal.saved} currency={goal.currency} />
                    <Typography variant="caption"> saved</Typography>
                  </View>
                  <CaretRight size={17} color={tokens.foregroundSubtle} />
                </View>
                <Progress
                  value={Math.min(100, Math.max(0, goal.percent))}
                  color={goal.color ?? tokens.primary}
                />
                <Typography variant="caption">
                  {goal.percent}% of <Money amountMinor={goal.target} currency={goal.currency} />
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
