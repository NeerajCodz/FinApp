import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Button, Input, Label, Text, Typography, useTheme } from '@finapp/ui/native';
import { CategoryEmojiPicker } from './CategoryEmojiPicker';
import { EntityColorPicker } from './EntityColorPicker';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyInput } from './CurrencyInput';
import { TransactionRow } from './TransactionRow';
import { formatMinor } from '../money';
type EntityActivity = {
  id: string;
  title: string;
  merchant?: string;
  category?: string;
  categoryIcon?: string;
  account?: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  type: string;
};
import { FinanceEmptyState } from './FinanceEmptyState';
export type CategoryFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  color?: string;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onIconChange: (value?: string) => void;
  onKindChange: (value: 'expense' | 'income') => void;
  onColorChange: (value?: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  currency?: string;
  limitValue?: string;
  onLimitChange?: (value: string) => void;
  notes?: string;
  onNotesChange?: (value: string) => void;
  includeInBudgets?: boolean;
  onIncludeInBudgetsChange?: (value: boolean) => void;
  isDefault?: boolean;
  onDefaultChange?: (value: boolean) => void;
  spentMinor?: bigint;
  monthlyLimitMinor?: bigint;
  activity?: readonly EntityActivity[];
  onOpenTransaction?: (id: string) => void;
  onViewTransactions?: () => void;
  onOpenAnalytics?: () => void;
};
export function CategoryFormScreen({
  mode,
  name,
  icon,
  kind,
  color,
  pending = false,
  error,
  onNameChange,
  onIconChange,
  onKindChange,
  onColorChange,
  onSubmit,
  onBack,
  currency = 'INR',
  limitValue = '',
  onLimitChange,
  notes = '',
  onNotesChange,
  includeInBudgets = true,
  onIncludeInBudgetsChange,
  isDefault = false,
  onDefaultChange,
  spentMinor = 0n,
  monthlyLimitMinor,
  activity = [],
  onOpenTransaction,
  onViewTransactions,
  onOpenAnalytics,
}: CategoryFormScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const edit = mode === 'edit';
  const used =
    monthlyLimitMinor && monthlyLimitMinor > 0n
      ? Number((spentMinor * 100n) / monthlyLimitMinor)
      : 0;
  const panel = {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 11,
    backgroundColor: tokens.surfaceSubtle,
  } as const;
  const field = { gap: 7 } as const;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 28,
          gap: 14,
        }}
      >
        <Button variant="ghost" onPress={onBack} style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={18} color={tokens.foreground} /> Back to categories
        </Button>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {edit && <CategoryIcon label={name} icon={icon} />}
          <View style={{ flex: 1, gap: 5 }}>
            <Typography variant="title" style={{ fontSize: 29 }}>
              {edit ? 'Edit Category' : 'New category'}
            </Typography>
            <Typography variant="small">
              {edit
                ? 'Update details and preferences for this category.'
                : 'Create a category to organize your transactions.'}
            </Typography>
          </View>
        </View>
        <View style={panel}>
          {edit && <Typography variant="heading">Category details</Typography>}
          <View style={field}>
            <Label>Name</Label>
            <Input
              accessibilityLabel="Category name"
              value={name}
              onChangeText={onNameChange}
              placeholder="Enter category name"
              maxLength={80}
            />
          </View>
          <View style={field}>
            <Label>Type</Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['expense', 'income'] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: kind === type }}
                  onPress={() => onKindChange(type)}
                  style={{
                    flex: 1,
                    minHeight: 55,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor:
                      kind === type
                        ? type === 'expense'
                          ? tokens.expense
                          : tokens.income
                        : tokens.border,
                    borderRadius: 8,
                    backgroundColor: kind === type ? tokens.surfaceRaised : 'transparent',
                  }}
                >
                  <Text style={{ color: type === 'expense' ? tokens.expense : tokens.income }}>
                    {type === 'expense' ? '↓' : '↗'}
                  </Text>
                  <Text>{type === 'expense' ? 'Expense' : 'Income'}</Text>
                  <Text>{kind === type ? '◉' : '○'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {onLimitChange && (
            <View style={field}>
              <Label>Monthly limit (optional)</Label>
              <CurrencyInput currency={currency} value={limitValue} onChangeText={onLimitChange} />
              {!edit && (
                <Typography variant="caption">
                  Set a monthly limit to keep track of your spending.
                </Typography>
              )}
            </View>
          )}
          {!edit && (
            <>
              <View style={field}>
                <Label>Emoji / Icon</Label>
                <CategoryEmojiPicker value={icon} onChange={onIconChange} />
              </View>
              <View style={field}>
                <Label>Color (optional)</Label>
                <EntityColorPicker value={color} onChange={onColorChange} />
              </View>
            </>
          )}
          {onNotesChange && (
            <View style={field}>
              <Label>Notes (optional)</Label>
              <Input
                accessibilityLabel="Category notes"
                value={notes}
                onChangeText={onNotesChange}
                multiline
                maxLength={200}
                placeholder="Add a note about this category…"
                style={{ minHeight: 85, textAlignVertical: 'top' }}
              />
              {edit && (
                <Typography variant="caption" style={{ textAlign: 'right' }}>
                  {notes.length}/200
                </Typography>
              )}
            </View>
          )}
          {edit && (
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <CategoryEmojiPicker value={icon} onChange={onIconChange} />
              <EntityColorPicker value={color} onChange={onColorChange} />
            </View>
          )}
        </View>
        {edit && (
          <>
            <View style={panel}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="heading">Limit usage</Typography>
                <Typography variant="caption">
                  {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Typography>
              </View>
              {monthlyLimitMinor ? (
                <>
                  <Text>
                    <Text style={{ fontSize: 22, fontWeight: '600' }}>{used}%</Text> of{' '}
                    {formatMinor(monthlyLimitMinor, currency)}
                  </Text>
                  <View
                    style={{
                      height: 10,
                      borderRadius: 8,
                      backgroundColor: tokens.surfaceRaised,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, used)}%`,
                        backgroundColor: used >= 80 ? tokens.warning : tokens.income,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontWeight: '600' }}>{formatMinor(spentMinor, currency)}</Text>
                      <Typography variant="caption">Spent</Typography>
                    </View>
                    <View>
                      <Text style={{ fontWeight: '600' }}>
                        {formatMinor(monthlyLimitMinor - spentMinor, currency)}
                      </Text>
                      <Typography variant="caption">Remaining</Typography>
                    </View>
                  </View>
                </>
              ) : (
                <Typography variant="small">No monthly limit set.</Typography>
              )}
            </View>
            {onOpenAnalytics && (
              <View style={panel}>
                <Typography variant="heading">Category analytics</Typography>
                <Typography variant="small">
                  View detailed spending trends, charts, and insights for this category.
                </Typography>
                <Button variant="outline" onPress={onOpenAnalytics}>
                  Open analytics ↗
                </Button>
              </View>
            )}
            <View style={panel}>
              <Typography variant="heading">Category settings</Typography>
              {onDefaultChange && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text>Set as default category</Text>
                    <Typography variant="caption">
                      Pre-selected for new {kind} transactions.
                    </Typography>
                  </View>
                  <Switch
                    accessibilityLabel="Set as default category"
                    value={isDefault}
                    onValueChange={onDefaultChange}
                    trackColor={{ true: tokens.primary, false: tokens.border }}
                  />
                </View>
              )}
              {onIncludeInBudgetsChange && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text>Include in budgets</Text>
                    <Typography variant="caption">
                      Show in budget planning and summaries.
                    </Typography>
                  </View>
                  <Switch
                    accessibilityLabel="Include in budgets"
                    value={includeInBudgets}
                    onValueChange={onIncludeInBudgetsChange}
                    trackColor={{ true: tokens.primary, false: tokens.border }}
                  />
                </View>
              )}
            </View>
            <View style={panel}>
              <Typography variant="heading">Recent transactions</Typography>
              {activity.length ? (
                activity
                  .slice(0, 5)
                  .map((row) => (
                    <TransactionRow
                      key={row.id}
                      title={row.title}
                      category={row.category}
                      categoryIcon={row.categoryIcon}
                      account={row.account}
                      date={row.date}
                      amountMinor={row.amountMinor}
                      currency={row.currency}
                      type={row.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'}
                      onPress={onOpenTransaction ? () => onOpenTransaction(row.id) : undefined}
                    />
                  ))
              ) : (
                <FinanceEmptyState
                  kind="activity"
                  title="No posted transactions yet."
                  description="Activity recorded for this category will appear here."
                  compact
                />
              )}
              {onViewTransactions && (
                <Button variant="ghost" onPress={onViewTransactions}>
                  View all transactions ›
                </Button>
              )}
            </View>
          </>
        )}
        {!!error && <Text style={{ color: tokens.destructive }}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="outline" onPress={onBack}>
            Cancel
          </Button>
          <Button style={{ flex: 1 }} onPress={onSubmit} disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : edit ? 'Save changes' : 'Create category'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
