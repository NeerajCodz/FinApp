import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, Check, Landmark } from '@finapp/ui/icons/native';
import {
  Button,
  IconButton,
  Input,
  Label,
  Sheet,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { CurrencyInput } from './CurrencyInput';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';

export type AccountFormValue = {
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  customType: string;
  currency: string;
  openingBalance: string;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
};
const accountTypes = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank', value: 'bank' },
  { label: 'Card', value: 'card' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Loan', value: 'loan' },
  { label: 'Custom', value: 'other' },
] as const;

export function AccountFormScreen({
  title,
  subtitle,
  value,
  currencies,
  saving = false,
  disabled = false,
  error,
  onChange,
  onSubmit,
  onBack,
  submitLabel,
}: {
  title: string;
  subtitle: string;
  value: AccountFormValue;
  currencies: readonly string[];
  saving?: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (value: AccountFormValue) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitLabel: string;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<'type' | 'currency' | null>(null);
  const set = (patch: Partial<AccountFormValue>) => onChange({ ...value, ...patch });
  const select = (option: string) => {
    if (sheet === 'type')
      set({
        type: option as AccountFormValue['type'],
        customType: option === 'other' ? value.customType : '',
      });
    if (sheet === 'currency') set({ currency: option });
    setSheet(null);
  };
  const panel = {
    gap: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surfaceSubtle,
  } as const;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        gap: 18,
      }}
    >
      <IconButton
        label="Back to accounts"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={onBack}
      >
        <ArrowLeft size={20} color={tokens.foreground} />
      </IconButton>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: value.color ?? tokens.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value.icon ? (
            <EntityIcon value={value.icon} size={20} color={value.color ? '#fff' : undefined} />
          ) : (
            <Landmark size={20} color={tokens.foreground} />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Typography variant="title">{title}</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>{subtitle}</Text>
        </View>
      </View>
      <View style={{ gap: 16 }}>
        <View style={panel}>
          <View>
            <Typography variant="bodyLarge">Basic information</Typography>
            <Typography variant="caption">
              Set the details used throughout your finances.
            </Typography>
          </View>
          <View>
            <Label>Account name</Label>
            <Input
              accessibilityLabel="Account name"
              value={value.name}
              onChangeText={(name) => set({ name })}
              placeholder="e.g. Everyday account"
              maxLength={80}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Label>Account type</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account type"
              onPress={() => setSheet('type')}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 13,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{accountTypes.find((item) => item.value === value.type)?.label}</Text>
              <CaretRight
                size={17}
                color={tokens.foregroundMuted}
                style={{ transform: [{ rotate: '90deg' }] }}
              />
            </Pressable>
          </View>
          {value.type === 'other' && (
            <View>
              <Label>Custom type</Label>
              <Input
                accessibilityLabel="Custom account type"
                value={value.customType}
                onChangeText={(customType) => set({ customType })}
                maxLength={40}
              />
            </View>
          )}
          <View style={{ gap: 6 }}>
            <Label>Currency</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Currency"
              onPress={() => setSheet('currency')}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 13,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{value.currency || 'Choose currency'}</Text>
              <CaretRight
                size={17}
                color={tokens.foregroundMuted}
                style={{ transform: [{ rotate: '90deg' }] }}
              />
            </Pressable>
          </View>
          {!!value.currency && (
            <View>
              <Label>Opening balance · {value.currency}</Label>
              <CurrencyInput
                currency={value.currency}
                value={value.openingBalance}
                onChangeText={(openingBalance) => set({ openingBalance })}
              />
            </View>
          )}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.isIncludedInTotal }}
            onPress={() => set({ isIncludedInTotal: !value.isIncludedInTotal })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View
              style={{
                width: 21,
                height: 21,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: value.isIncludedInTotal ? tokens.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {value.isIncludedInTotal && <Check size={15} color={tokens.background} />}
            </View>
            <View>
              <Text>Include in total</Text>
              <Typography variant="caption">Count this account in your total balance.</Typography>
            </View>
          </Pressable>
        </View>
        <View style={panel}>
          <View>
            <Typography variant="bodyLarge">Account icon</Typography>
            <Typography variant="caption">Choose a Lucide icon for quick recognition.</Typography>
          </View>
          <EntityIconPicker
            mode="lucide"
            value={value.icon}
            onChange={(icon) => set({ icon })}
            label="Account icon"
          />
        </View>
        <View style={panel}>
          <View>
            <Typography variant="bodyLarge">Account color</Typography>
            <Typography variant="caption">Choose a color for your account.</Typography>
          </View>
          <EntityColorPicker
            value={value.color}
            onChange={(color) => set({ color })}
            label="Account color"
          />
        </View>
      </View>
      {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
      <Button
        size="lg"
        disabled={
          disabled ||
          saving ||
          !value.name.trim() ||
          !value.currency ||
          !value.color ||
          (value.type === 'other' && !value.customType.trim())
        }
        onPress={onSubmit}
      >
        {saving ? 'Saving…' : submitLabel}
      </Button>
      <Sheet
        visible={sheet !== null}
        title={sheet === 'type' ? 'Account type' : 'Currency'}
        onClose={() => setSheet(null)}
      >
        {(sheet === 'type'
          ? accountTypes.map(({ label, value: option }) => ({ label, value: option }))
          : currencies.map((currency) => ({ label: currency, value: currency }))
        ).map((item) => {
          const selected =
            sheet === 'type' ? value.type === item.value : value.currency === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={item.label}
              onPress={() => select(item.value)}
              style={{
                minHeight: 48,
                borderRadius: 12,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: selected ? tokens.surfaceRaised : 'transparent',
              }}
            >
              <Text>{item.label}</Text>
              {selected && <Check size={19} color={tokens.primary} />}
            </Pressable>
          );
        })}
      </Sheet>
    </ScrollView>
  );
}
