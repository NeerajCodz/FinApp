import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { ArrowLeft, ArrowRight, ReceiptText, UsersThree } from '@/lib/icons';
import { CategoryIcon, CurrencyInput, SettingsRow } from '@/components/finance';
import { Button, IconButton, Input, Separator, Sheet, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';

type TransactionType = 'expense' | 'income' | 'transfer';
type ProfileRecord = LocalRecord & {
  defaultCurrency?: string;
  defaultAccountId?: string | null;
  defaultExpenseCategoryId?: string | null;
  defaultIncomeCategoryId?: string | null;
};
type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  currency: string;
  archivedAt?: number;
};
type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  icon?: string;
  archivedAt?: number;
};
type Picker = 'category' | 'account' | 'destination' | 'date' | null;
const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

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
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={new Date(year, month, day).toLocaleDateString(undefined, {
                    dateStyle: 'full',
                  })}
                  accessibilityState={{ selected }}
                  onPress={() => onChange(new Date(year, month, day, 12))}
                  activeOpacity={0.7}
                  style={{
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: selected ? tokens.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: selected ? tokens.primaryForeground : tokens.foreground,
                      fontFamily: 'SpaceGrotesk_500Medium',
                    }}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
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
  const params = useLocalSearchParams<{
    type?: string | string[]; amount?: string | string[]; accountId?: string | string[];
    categoryId?: string | string[]; destinationId?: string | string[];
    occurredAt?: string | string[]; note?: string | string[];
  }>();
  const queryType = scalar(params.type);
  const initialType: TransactionType = transactionTypes.includes(queryType as TransactionType)
    ? (queryType as TransactionType) : 'expense';
  const initialAmount = scalar(params.amount);
  const initialDate = Number(scalar(params.occurredAt));
  const [amount, setAmount] = useState(initialAmount && amountInMinor(initialAmount) ? initialAmount : '');
  const [type, setType] = useState<TransactionType>(initialType);
  const [categoryId, setCategoryId] = useState<string | null>(scalar(params.categoryId) || null);
  const [accountId, setAccountId] = useState<string | null>(scalar(params.accountId) || null);
  const [destinationId, setDestinationId] = useState<string | null>(scalar(params.destinationId) || null);
  const [date, setDate] = useState(() => Number.isFinite(initialDate) && initialDate > 0 ? new Date(initialDate) : new Date());
  const [note, setNote] = useState(scalar(params.note) ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profile = profileState.data?.[0];
  const accounts = accountState.data?.filter((item) => item.archivedAt === undefined);
  const categories = categoryState.data?.filter((item) => item.archivedAt === undefined);
  const categoryOptions = categories;
  const account =
    accounts?.find((item) => String(item.id ?? item._id) === accountId || item.cloudId === accountId) ??
    accounts?.find(
      (item) =>
        String(item.id ?? item._id) === String(profile?.defaultAccountId) ||
        item.cloudId === profile?.defaultAccountId,
    ) ??
    accounts?.[0];
  const preferredCategoryId =
    type === 'expense' ? profile?.defaultExpenseCategoryId : profile?.defaultIncomeCategoryId;
  const category =
    categoryOptions?.find(
      (item) =>
        String(item.id ?? item._id) === categoryId || item.cloudId === categoryId,
    ) ??
    categoryOptions?.find(
      (item) =>
        String(item.id ?? item._id) === String(preferredCategoryId) ||
        item.cloudId === preferredCategoryId,
    ) ??
    categoryOptions?.[0];
  const destination = accounts?.find((item) => String(item.id ?? item._id) === destinationId || item.cloudId === destinationId);
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
    if (saveDisabled || !account || !validAmount || !userId) return;
    setSaving(true);
    setError('');
    try {
      const accountRecordId = String(account.id ?? account._id);
      const categoryRecordId = category ? String(category.id ?? category._id) : undefined;
      const destinationRecordId = destination ? String(destination.id ?? destination._id) : undefined;
      const title =
        type === 'transfer' ? `Transfer to ${destination!.name}` : note.trim() || category!.name;
      const payload = {
        accountId: accountRecordId,
        type,
        amountMinor: validAmount,
        currency: String(account.currency),
        categoryId: type === 'transfer' ? undefined : categoryRecordId,
        title,
        note: note.trim() || undefined,
        transferAccountId: type === 'transfer' ? destinationRecordId : undefined,
        occurredAt: date.getTime(),
      };
      const record: LocalRecord = {
        accountId: accountRecordId,
        categoryId: type === 'transfer' ? undefined : categoryRecordId,
        transferAccountId: type === 'transfer' ? destinationRecordId : undefined,
        amountMinor: validAmount,
        currency: String(account.currency),
        occurredAt: date.getTime(),
        type,
        status: 'posted',
        title,
        note: note.trim() || undefined,
      };
      const dependencies = [
        !account.cloudId && !account._id ? `account:${accountRecordId}` : null,
        type !== 'transfer' && category && !category.cloudId && !category._id
          ? `category:${categoryRecordId}`
          : null,
        type === 'transfer' && destination && !destination.cloudId && !destination._id
          ? `account:${destinationRecordId}`
          : null,
      ].filter((dependency): dependency is string => dependency !== null);
      await commitLocalWrite(userId, 'transaction', 'transaction.create', record, payload, {
        dependencies,
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
    if (!userId) return;
    const currentProfile = profile ?? { id: userId };
    try {
      if (picker === 'account' && account) {
        const id = String(account.id ?? account._id);
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...currentProfile, defaultAccountId: id },
          { accountId: id },
          { dependencies: !account.cloudId && !account._id ? [`account:${id}`] : [] },
        );
      }
      if (picker === 'category' && category) {
        const id = String(category.id ?? category._id);
        const field = type === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          { ...currentProfile, [field]: id },
          { transactionType: type as 'expense' | 'income', categoryId: id },
          { dependencies: !category.cloudId && !category._id ? [`category:${id}`] : [] },
        );
      }
      toast.success('Default saved');
      setPicker(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save default');
    }
  }

  async function clearDefault() {
    if (!userId) return;
    const currentProfile = profile ?? { id: userId };
    try {
      if (picker === 'account')
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...currentProfile, defaultAccountId: null },
          { accountId: null },
        );
      if (picker === 'category') {
        const field = type === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          { ...currentProfile, [field]: null },
          { transactionType: type as 'expense' | 'income', categoryId: null },
        );
      }
      setPicker(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear default');
    }
  }

  const pickerOptions =
    picker === 'category'
      ? categoryOptions?.map((item) => ({ id: String(item.id ?? item._id), name: String(item.name), icon: item.icon }))
      : accounts
          ?.filter(
            (item) =>
              picker !== 'destination' ||
              (String(item.id ?? item._id) !== String(account?.id ?? account?._id) &&
                item.currency === account?.currency),
          )
          .map((item) => ({
            id: String(item.id ?? item._id),
            name: `${String(item.name)} · ${String(item.currency)}`,
          }));
  const selectedId =
    picker === 'category'
      ? category && String(category.id ?? category._id)
      : picker === 'destination'
        ? destination && String(destination.id ?? destination._id)
        : account && String(account.id ?? account._id);
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
              <Button
                key={item}
                size="sm"
                variant={selected ? 'primary' : 'ghost'}
                accessibilityLabel={`${item} transaction`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setType(item);
                  setCategoryId(null);
                }}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 10,
                  backgroundColor: selected ? color : 'transparent',
                }}
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
              </Button>
            );
          })}
        </View>
        <View>
          {type !== 'transfer' && (
            <>
              <SettingsRow
                label="Category"
                leadingIcon={
                  <CategoryIcon
                    label={category?.name ?? 'Category'}
                    icon={category?.icon}
                  />
                }
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
            Add a category before recording a transaction.
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
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: item.id === selectedId }}
                    onPress={() => selectValue(item.id)}
                    activeOpacity={0.72}
                    style={{
                      minHeight: 60,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {picker === 'category' && (
                      <CategoryIcon
                        label={item.name}
                        icon={
                          'icon' in item && typeof item.icon === 'string' ? item.icon : undefined
                        }
                        selected={item.id === selectedId}
                      />
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
                  </TouchableOpacity>
                  {index < (pickerOptions?.length ?? 0) - 1 && <Separator />}
                </React.Fragment>
              ))}
              {pickerOptions === undefined ? (
                <Typography variant="small">
                  Loading {picker === 'category' ? 'categories' : 'accounts'}…
                </Typography>
              ) : pickerOptions.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 18, gap: 8 }}>
                  {picker === 'category'
                    ? <CategoryIcon label="Category" />
                    : <ReceiptText size={24} color={tokens.foregroundMuted} />}
                  <Typography variant="bodyLarge">
                    {picker === 'category' ? 'No categories yet' : 'No accounts yet'}
                  </Typography>
                  <Typography variant="small" style={{ textAlign: 'center' }}>
                    {picker === 'category' ? 'Create a category to organize this transaction.' : 'Add an account before recording this transaction.'}
                  </Typography>
                </View>
              ) : null}
            </ScrollView>
            {picker === 'category' && (
              <Button
                variant="outline"
                onPress={() => {
                  setPicker(null);
                  router.push(pickerOptions?.length === 0 ? '/category/new' as never : '/category' as never);
                }}
              >
                {pickerOptions?.length === 0 ? 'Create category' : 'Manage categories'}
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
            {(picker === 'category' || picker === 'account') && (selectedId || defaultId) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {selectedId && selectedId !== defaultId && (
                  <Button size="sm" variant="outline" onPress={saveDefault}>Set as default</Button>
                )}
                {defaultId && (
                  <Button size="sm" variant="ghost" onPress={clearDefault}>Clear default</Button>
                )}
              </View>
            )}
          </>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
