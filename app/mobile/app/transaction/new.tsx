import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast } from '@/lib/toast';
import { ArrowLeft, ArrowRight, ReceiptText, UsersThree } from '@/lib/icons';
import { CategoryIcon, CurrencyInput, SettingsRow } from '@/components/finance';
import { Button, IconButton, Input, Separator, Sheet, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TransactionType = 'expense' | 'income' | 'transfer';
type Picker = 'category' | 'account' | 'destination' | 'date' | null;
const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function amountInMinor(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole = '', fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return minor > 0n && minor <= 9223372036854775807n ? minor : null;
}

function DateSelector({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const { tokens } = useTheme();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: leading + days }, (_, index) =>
    index < leading ? 0 : index - leading + 1,
  );
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outline"
          size="sm"
          accessibilityLabel="Previous month"
          onPress={() => setVisibleMonth(new Date(year, month - 1, 1))}
        >
          ‹
        </Button>
        <Typography variant="bodyLarge">
          {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Typography>
        <Button
          variant="outline"
          size="sm"
          accessibilityLabel="Next month"
          onPress={() => setVisibleMonth(new Date(year, month + 1, 1))}
        >
          ›
        </Button>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {weekdays.map((day) => (
          <Typography
            key={day}
            variant="caption"
            style={{ width: '14.2857%', textAlign: 'center' }}
          >
            {day}
          </Typography>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, index) => {
          const selected =
            day > 0 &&
            value.getFullYear() === year &&
            value.getMonth() === month &&
            value.getDate() === day;
          return (
            <View key={index} style={{ width: '14.2857%', padding: 2 }}>
              {day > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={new Date(year, month, day).toLocaleDateString(undefined, {
                    dateStyle: 'full',
                  })}
                  accessibilityState={{ selected }}
                  onPress={() => onChange(new Date(year, month, day, 12))}
                  style={({ pressed }) => ({
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: selected
                      ? tokens.primary
                      : pressed
                        ? tokens.surfaceRaised
                        : 'transparent',
                  })}
                >
                  <Text
                    style={{
                      color: selected ? tokens.primaryForeground : tokens.foreground,
                      fontFamily: 'SpaceGrotesk_500Medium',
                    }}
                  >
                    {day}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <Button variant="outline" onPress={() => onChange(new Date())}>
        Today
      </Button>
    </View>
  );
}

export default function NewTransactionScreen() {
  const { type: queryType } = useLocalSearchParams<{ type?: string }>();
  const initialType: TransactionType = transactionTypes.includes(queryType as TransactionType)
    ? (queryType as TransactionType)
    : 'expense';
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(initialType);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useQuery(api.users.queries.current);
  const accounts = useQuery(api.accounts.queries.list);
  const categories = useQuery(api.categories.queries.list);
  const createTransaction = useMutation(api.transactions.mutations.create);
  const setDefaultAccount = useMutation(api.users.mutations.setDefaultAccount);
  const setDefaultCategory = useMutation(api.users.mutations.setDefaultCategory);
  const categoryOptions = categories?.filter((item) => item.kind === type);
  const account =
    accounts?.find((item) => item.id === accountId) ??
    accounts?.find((item) => item.id === profile?.defaultAccountId) ??
    accounts?.[0];
  const preferredCategoryId =
    type === 'expense' ? profile?.defaultExpenseCategoryId : profile?.defaultIncomeCategoryId;
  const category =
    categoryOptions?.find((item) => item._id === categoryId) ??
    categoryOptions?.find((item) => item._id === preferredCategoryId) ??
    categoryOptions?.[0];
  const destination = accounts?.find((item) => item.id === destinationId);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const typeColor =
    type === 'expense' ? tokens.expense : type === 'income' ? tokens.income : tokens.warning;
  const validAmount = amountInMinor(amount);
  const saveDisabled =
    saving ||
    !validAmount ||
    !account ||
    (type === 'transfer'
      ? !destination || destination.id === account.id || destination.currency !== account.currency
      : !category);
  const defaultId =
    picker === 'account'
      ? profile?.defaultAccountId
      : type === 'expense'
        ? profile?.defaultExpenseCategoryId
        : profile?.defaultIncomeCategoryId;

  async function save() {
    if (saveDisabled || !account || !validAmount) return;
    setSaving(true);
    setError('');
    try {
      await createTransaction({
        accountId: account.id as never,
        type,
        amountMinor: validAmount,
        currency: account.currency,
        categoryId: type === 'transfer' ? undefined : category?._id,
        title:
          type === 'transfer' ? `Transfer to ${destination!.name}` : note.trim() || category!.name,
        note: note.trim() || undefined,
        transferAccountId: type === 'transfer' ? (destination!.id as never) : undefined,
        occurredAt: date.getTime(),
        clientMutationId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(`${typeLabel} added`);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not save ${type}`);
    } finally {
      setSaving(false);
    }
  }

  function selectValue(id: string) {
    void Haptics.selectionAsync();
    if (picker === 'category') setCategoryId(id);
    if (picker === 'account') {
      setAccountId(id);
      setDestinationId(null);
    }
    if (picker === 'destination') setDestinationId(id);
    setPicker(null);
  }

  async function saveDefault() {
    try {
      if (picker === 'account' && account)
        await setDefaultAccount({ accountId: account.id as never });
      if (picker === 'category' && category)
        await setDefaultCategory({ kind: type as 'expense' | 'income', categoryId: category._id });
      toast.success('Default saved');
      setPicker(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save default');
    }
  }

  async function clearDefault() {
    try {
      if (picker === 'account') await setDefaultAccount({ accountId: null });
      if (picker === 'category')
        await setDefaultCategory({ kind: type as 'expense' | 'income', categoryId: null });
      setPicker(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear default');
    }
  }

  const pickerOptions =
    picker === 'category'
      ? categoryOptions?.map((item) => ({ id: item._id, name: item.name }))
      : accounts
          ?.filter(
            (item) =>
              picker !== 'destination' ||
              (item.id !== account?.id && item.currency === account?.currency),
          )
          .map((item) => ({ id: item.id, name: `${item.name} · ${item.currency}` }));
  const selectedId =
    picker === 'category'
      ? category?._id
      : picker === 'destination'
        ? destination?.id
        : account?.id;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Cancel" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="bodyLarge" style={{ flex: 1, textAlign: 'center' }}>
            Add {type}
          </Typography>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center' }}>
          <CurrencyInput
            currency={account?.currency ?? profile?.defaultCurrency ?? 'INR'}
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            padding: 4,
            gap: 4,
            borderRadius: 12,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          {transactionTypes.map((item) => {
            const selected = item === type;
            const color =
              item === 'expense'
                ? tokens.expense
                : item === 'income'
                  ? tokens.income
                  : tokens.warning;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setType(item);
                  setCategoryId(null);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? color : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={{
                    color: selected ? '#000000' : tokens.foregroundMuted,
                    fontFamily: 'SpaceGrotesk_600SemiBold',
                    fontSize: 13,
                  }}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View>
          {type !== 'transfer' && (
            <>
              <SettingsRow
                label="Category"
                value={
                  category?.name ?? (categoryOptions ? 'Choose a category' : 'Loading categories…')
                }
                onPress={() => setPicker('category')}
              />
              <Separator />
            </>
          )}
          <SettingsRow
            label={type === 'transfer' ? 'From account' : 'Account'}
            value={account?.name ?? (accounts ? 'Choose an account' : 'Loading accounts…')}
            onPress={() => setPicker('account')}
          />
          {type === 'transfer' && (
            <>
              <Separator />
              <SettingsRow
                label="To account"
                value={destination?.name ?? 'Choose destination'}
                onPress={() => setPicker('destination')}
              />
            </>
          )}
          <Separator />
          <SettingsRow
            label="Date"
            value={date.toLocaleDateString(undefined, { dateStyle: 'medium' })}
            onPress={() => setPicker('date')}
          />
        </View>
        <View style={{ gap: 12 }}>
          <Typography variant="label">Note</Typography>
          <Input
            accessibilityLabel="Transaction note"
            placeholder="What was this for?"
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />
          {type === 'expense' && (
            <Button
              variant="outline"
              onPress={() => router.push('/split/new' as never)}
              style={{ minHeight: 68, paddingHorizontal: 16, justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.controlDisabledBackground,
                  }}
                >
                  <UsersThree size={19} color={tokens.primary} />
                </View>
                <View style={{ gap: 2 }}>
                  <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
                    Split this expense
                  </Typography>
                  <Typography variant="caption">Choose people and shares</Typography>
                </View>
              </View>
              <ArrowRight size={18} color={tokens.foregroundSubtle} />
            </Button>
          )}
        </View>
        {accounts?.length === 0 && (
          <Typography
            style={{ color: tokens.foregroundMuted }}
            onPress={() => router.push('/account/new' as never)}
          >
            Add an account before recording a transaction.
          </Typography>
        )}
        {type !== 'transfer' && categoryOptions?.length === 0 && (
          <Typography
            style={{ color: tokens.foregroundMuted }}
            onPress={() => router.push('/category/new' as never)}
          >
            Add a {type} category before recording a transaction.
          </Typography>
        )}
        {!!error && <Typography style={{ color: tokens.expense }}>{error}</Typography>}
        <Button
          size="lg"
          disabled={!!saveDisabled}
          onPress={save}
          style={!saveDisabled ? { backgroundColor: typeColor } : undefined}
        >
          <ReceiptText
            size={18}
            color={saveDisabled ? tokens.controlDisabledForeground : '#000000'}
          />
          <Text
            style={{
              marginLeft: 8,
              color: saveDisabled ? tokens.controlDisabledForeground : '#000000',
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            {saving ? 'Saving…' : `Save ${type}`}
          </Text>
        </Button>
      </ScrollView>
      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={
          picker === 'date'
            ? 'Choose date'
            : picker === 'category'
              ? 'Choose category'
              : picker === 'destination'
                ? 'Choose destination'
                : 'Choose account'
        }
      >
        {picker === 'date' ? (
          <DateSelector
            value={date}
            onChange={(value) => {
              setDate(value);
              setPicker(null);
            }}
          />
        ) : (
          <>
            <ScrollView
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {pickerOptions?.map((item, index) => (
                <React.Fragment key={item.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: item.id === selectedId }}
                    onPress={() => selectValue(item.id)}
                    style={({ pressed }) => ({
                      minHeight: 60,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    {picker === 'category' && (
                      <CategoryIcon label={item.name} selected={item.id === selectedId} />
                    )}
                    <Text
                      style={{
                        flex: 1,
                        color: tokens.foreground,
                        fontFamily: 'SpaceGrotesk_500Medium',
                        fontSize: 16,
                      }}
                    >
                      {item.name}
                    </Text>
                    {item.id === selectedId && (
                      <Typography variant="caption" style={{ color: tokens.primary }}>
                        Selected
                      </Typography>
                    )}
                  </Pressable>
                  {index < (pickerOptions?.length ?? 0) - 1 && <Separator />}
                </React.Fragment>
              ))}
              {pickerOptions?.length === 0 && (
                <Typography variant="small">
                  {picker === 'category' ? 'No categories yet.' : 'No accounts available.'}
                </Typography>
              )}
            </ScrollView>
            {picker === 'category' && (
              <Button
                variant="outline"
                onPress={() => {
                  setPicker(null);
                  router.push('/category' as never);
                }}
              >
                Manage categories
              </Button>
            )}
            {picker === 'account' && (
              <Button
                variant="outline"
                onPress={() => {
                  setPicker(null);
                  router.push('/account/new' as never);
                }}
              >
                Add account
              </Button>
            )}
            {(picker === 'category' || picker === 'account') && selectedId && (
              <Button variant="outline" onPress={saveDefault} disabled={selectedId === defaultId}>
                Set selected as default
              </Button>
            )}
            {(picker === 'category' || picker === 'account') && defaultId && (
              <Button variant="ghost" onPress={clearDefault}>
                Clear default
              </Button>
            )}
          </>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
