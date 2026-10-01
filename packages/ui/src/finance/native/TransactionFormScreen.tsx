import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ReceiptText } from '@finapp/ui/icons/native';
import {
  Button,
  IconButton,
  Input,
  Separator,
  Sheet,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyInput } from './CurrencyInput';
import { DateTimePicker } from './DateTimePicker';

export type TransactionFormType = 'expense' | 'income' | 'transfer';
export type TransactionFormOption = { id: string; name: string; currency?: string; icon?: string };
export type TransactionFormScreenProps = {
  mode: 'create' | 'edit';
  type: TransactionFormType;
  title: string;
  amount: string;
  merchant: string;
  note: string;
  occurredAt: number;
  hasTime: boolean;
  currency: string;
  accounts: readonly TransactionFormOption[];
  categories: readonly TransactionFormOption[];
  accountId: string;
  categoryId: string;
  destinationId: string;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  dataError?: string | null;
  isDefaultAccount?: boolean;
  isDefaultCategory?: boolean;
  savingDefault?: boolean;
  onTypeChange: (type: TransactionFormType) => void;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMerchantChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onAccountChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onDestinationChange: (id: string) => void;
  onDateChange: (value: number) => void;
  onHasTimeChange: (enabled: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  onToggleDefault?: (selection: 'account' | 'category') => void;
  onAddAccount?: () => void;
  onManageCategories?: () => void;
  signedIn?: boolean;
  unavailableMessage?: string;
  submitDisabled?: boolean;
  onSplitExpense?: () => void;
};

export function TransactionFormScreen(props: TransactionFormScreenProps) {
  const {
    signedIn = true,
    unavailableMessage,
    mode,
    type,
    title,
    amount,
    merchant,
    note,
    occurredAt,
    hasTime,
    currency,
    accounts,
    categories,
    accountId,
    categoryId,
    destinationId,
    loading = false,
    saving = false,
    error,
    dataError,
    isDefaultAccount = false,
    isDefaultCategory = false,
    savingDefault = false,
    onTypeChange,
    onTitleChange,
    onAmountChange,
    onMerchantChange,
    onNoteChange,
    onAccountChange,
    onCategoryChange,
    onDestinationChange,
    onDateChange,
    onHasTimeChange,
    onSubmit,
    onBack,
    onToggleDefault,
    onAddAccount,
    onManageCategories,
    onSplitExpense,
    submitDisabled = false,
  } = props;
  const { tokens } = useTheme();
  const [picker, setPicker] = useState<'account' | 'category' | 'destination' | 'date' | null>(
    null,
  );
  const account = accounts.find((item) => item.id === accountId);
  const category = categories.find((item) => item.id === categoryId);
  const options =
    picker === 'category'
      ? categories
      : accounts.filter(
          (item) =>
            picker !== 'destination' ||
            (item.id !== accountId && item.currency === account?.currency),
        );
  const selectedId =
    picker === 'category' ? categoryId : picker === 'destination' ? destinationId : accountId;
  if (!signedIn)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24 }}>
        <Typography variant="heading">Sign in to manage transactions</Typography>
      </View>
    );
  if (unavailableMessage)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24 }}>
        <Text accessibilityRole="alert">{unavailableMessage}</Text>
      </View>
    );
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24 }}>
        <Typography variant="heading">Loading transaction options…</Typography>
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 28, gap: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Back to transactions" variant="ghost" onPress={onBack}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <View>
            <Typography variant="heading">
              {mode === 'create' ? 'New transaction' : 'Edit transaction'}
            </Typography>
            <Typography variant="caption">
              {mode === 'create'
                ? 'Add an income, expense, or transfer.'
                : 'Update this transaction.'}
            </Typography>
          </View>
        </View>
        <View
          style={{
            gap: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 18,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <Typography variant="label">Transaction type</Typography>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['expense', 'income', 'transfer'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={type === value ? 'primary' : 'outline'}
                onPress={() => onTypeChange(value)}
              >
                {value[0]!.toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </View>
          {type !== 'transfer' && (
            <Input
              accessibilityLabel="Transaction title"
              placeholder="Transaction title"
              value={title}
              onChangeText={onTitleChange}
            />
          )}
          <CurrencyInput
            currency={account?.currency ?? currency}
            value={amount}
            onChangeText={onAmountChange}
          />
          {type !== 'transfer' && (
            <View style={{ gap: 4 }}>
              <SettingsRow
                label="Category"
                leadingIcon={
                  <CategoryIcon label={category?.name ?? 'Category'} icon={category?.icon} />
                }
                value={category?.name ?? 'Choose category'}
                onPress={() => setPicker('category')}
              />
              <Separator />
            </View>
          )}
          <SettingsRow
            label={type === 'transfer' ? 'From account' : 'Account'}
            value={account?.name ?? 'Choose account'}
            onPress={() => setPicker('account')}
          />
          {type === 'transfer' && (
            <SettingsRow
              label="To account"
              value={
                accounts.find((item) => item.id === destinationId)?.name ?? 'Choose destination'
              }
              onPress={() => setPicker('destination')}
            />
          )}
          <SettingsRow
            label="Date"
            value={new Date(occurredAt).toLocaleDateString()}
            onPress={() => setPicker('date')}
          />
          <Button size="sm" variant="outline" onPress={() => onHasTimeChange(!hasTime)}>
            {hasTime ? 'Remove time' : 'Include time'}
          </Button>
          <Input
            accessibilityLabel="Merchant or payee"
            placeholder="Merchant / Payee (optional)"
            value={merchant}
            onChangeText={onMerchantChange}
          />
          <Input
            accessibilityLabel="Transaction note"
            placeholder="Notes (optional)"
            value={note}
            onChangeText={onNoteChange}
          />
          {mode === 'create' && (
            <View style={{ gap: 8 }}>
              <Button
                size="sm"
                variant="outline"
                disabled={savingDefault || !account}
                onPress={() => onToggleDefault?.('account')}
              >
                {isDefaultAccount ? 'Clear account default' : 'Set account as default'}
              </Button>
              {type !== 'transfer' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingDefault || !category}
                  onPress={() => onToggleDefault?.('category')}
                >
                  {isDefaultCategory ? 'Clear category default' : 'Set category as default'}
                </Button>
              )}
            </View>
          )}
          {mode === 'create' && type === 'expense' && (
            <Button variant="outline" onPress={onSplitExpense}>
              Split this expense
            </Button>
          )}
          {!accounts.length && (
            <Button variant="outline" onPress={onAddAccount}>
              Add an account
            </Button>
          )}
          {type !== 'transfer' && !categories.length && (
            <Button variant="outline" onPress={onManageCategories}>
              Create a category
            </Button>
          )}
          {dataError ? (
            <Text accessibilityRole="alert" style={{ color: tokens.expense }}>
              {dataError}
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: tokens.expense }}>
              {error}
            </Text>
          ) : null}
          <Separator />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button variant="outline" onPress={onBack} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={saving || submitDisabled}
              onPress={onSubmit}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Add transaction' : 'Save changes'}{' '}
              <ReceiptText size={17} color={tokens.foreground} />
            </Button>
          </View>
        </View>
      </ScrollView>
      <Sheet
        visible={picker !== null}
        title={picker === 'date' ? 'Choose date' : `Choose ${picker ?? ''}`}
        onClose={() => setPicker(null)}
      >
        {picker === 'date' ? (
          <DateTimePicker value={occurredAt} showTime={hasTime} onChange={onDateChange} />
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((item) => (
              <React.Fragment key={item.id}>
                <SettingsRow
                  label={item.name}
                  leadingIcon={
                    picker === 'category' ? (
                      <CategoryIcon label={item.name} icon={item.icon} />
                    ) : undefined
                  }
                  value={item.id === selectedId ? 'Selected' : item.currency}
                  onPress={() => {
                    if (picker === 'category') onCategoryChange(item.id);
                    else if (picker === 'destination') onDestinationChange(item.id);
                    else onAccountChange(item.id);
                    setPicker(null);
                  }}
                />
                <Separator />
              </React.Fragment>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

import { SettingsRow } from './ScreenPrimitives';
