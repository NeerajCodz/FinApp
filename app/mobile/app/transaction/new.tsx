import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { ArrowLeft, ArrowRight, ReceiptText, UsersThree } from '@/lib/icons';
import { CategoryIcon, CurrencyInput, SettingsRow } from '@/components/finance';
import {
  Button,
  IconButton,
  Input,
  Separator,
  Sheet,
  Tabs,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const transactionTypes = ['expense', 'income', 'transfer'] as const;
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment'];
const accounts = ['HDFC', 'Cash', 'Savings'];

type Picker = 'category' | 'account' | null;

export default function NewTransactionScreen() {
  const { type: queryType } = useLocalSearchParams<{ type?: string }>();
  const initialType = transactionTypes.includes(queryType as (typeof transactionTypes)[number])
    ? (queryType as (typeof transactionTypes)[number])
    : 'expense';
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(initialType);
  const [category, setCategory] = useState('Food');
  const [account, setAccount] = useState('HDFC');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<Picker>(null);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const saveDisabled = !amount || Number(amount) <= 0;

  async function save() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success(`${typeLabel} added`);
    router.back();
  }

  function selectValue(value: string) {
    void Haptics.selectionAsync();
    if (picker === 'category') setCategory(value);
    if (picker === 'account') setAccount(value);
    setPicker(null);
  }

  const pickerValues = picker === 'category' ? categories : accounts;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          <CurrencyInput currency="INR" value={amount} onChangeText={setAmount} />
        </View>

        <Tabs
          value={type}
          onChange={(value) => setType(value as (typeof transactionTypes)[number])}
          tabs={transactionTypes.map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
          }))}
        />

        <View>
          <SettingsRow label="Category" value={category} onPress={() => setPicker('category')} />
          <Separator />
          <SettingsRow label="Account" value={account} onPress={() => setPicker('account')} />
          <Separator />
          <SettingsRow label="Date" value="Today" />
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
          <Button
            variant="outline"
            onPress={() => router.push('/split/new' as never)}
            style={{
              minHeight: 68,
              paddingHorizontal: 16,
              justifyContent: 'space-between',
            }}
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
        </View>

        <Button size="lg" disabled={saveDisabled} onPress={save}>
          <ReceiptText
            size={18}
            color={saveDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground}
          />
          <Text
            style={{
              marginLeft: 8,
              color: saveDisabled
                ? tokens.controlDisabledForeground
                : tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            {`Save ${type}`}
          </Text>
        </Button>
      </ScrollView>

      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'category' ? 'Choose category' : 'Choose account'}
      >
        <View>
          {pickerValues.map((value, index) => {
            const selected = value === (picker === 'category' ? category : account);
            return (
              <React.Fragment key={value}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectValue(value)}
                  style={({ pressed }) => ({
                    minHeight: 64,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  {picker === 'category' && <CategoryIcon label={value} selected={selected} />}
                  <Text style={{ flex: 1, fontFamily: 'SpaceGrotesk_500Medium' }}>{value}</Text>
                  {selected && (
                    <Typography variant="caption" style={{ color: tokens.primary }}>
                      SELECTED
                    </Typography>
                  )}
                </Pressable>
                {index < pickerValues.length - 1 && <Separator />}
              </React.Fragment>
            );
          })}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
