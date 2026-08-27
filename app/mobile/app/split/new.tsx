import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { toast } from '@/lib/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyInput, SettingsRow } from '@/components/finance';
import { Button, Checkbox, IconButton, Separator, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SplitExpenseScreen() {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('equal');
  const [included, setIncluded] = useState(true);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function save() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Split saved');
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading">Split expense</Typography>
        </View>

        <View style={{ minHeight: 130, justifyContent: 'center' }}>
          <CurrencyInput currency="INR" value={amount} onChangeText={setAmount} />
        </View>

        <View>
          <SettingsRow label="Paid by" value="You" />
          <Separator />
          <SettingsRow label="Group" value="Choose later" />
        </View>

        <View style={{ gap: 12 }}>
          <Typography variant="label">Split</Typography>
          <Tabs
            value={method}
            onChange={setMethod}
            tabs={[
              { label: 'Equal', value: 'equal' },
              { label: 'Exact', value: 'exact' },
              { label: '%', value: 'percentage' },
              { label: 'Shares', value: 'shares' },
            ]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Typography variant="label">1 person</Typography>
          <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Checkbox checked={included} onChange={setIncluded} label="You" />
            <Text
              style={{
                marginLeft: 'auto',
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontVariant: ['tabular-nums'],
              }}
            >
              ₹{amount || '0'}
            </Text>
          </View>
        </View>

        <Separator />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="bodyLarge">Total</Typography>
          <Typography variant="bodyLarge" style={{ fontVariant: ['tabular-nums'] }}>
            ₹{amount || '0'}
          </Typography>
        </View>

        <Button size="lg" disabled={!amount || !included} onPress={save}>
          Save split
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
