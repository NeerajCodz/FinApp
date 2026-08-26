import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check, NotePencil } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { toast } from 'sonner-native';
import { AmountKeypad, CurrencyInput } from '@/components/finance';
import { Button, Card, IconButton, Input, Select, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
export default function NewTransactionScreen() {
  const { type: queryType } = useLocalSearchParams<{ type?: string }>();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(queryType ?? 'expense');
  const [note, setNote] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  function save() {
    toast.success('Entry saved', { description: `${typeLabel} is ready to sync.` });
    router.back();
  }
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        gap: 22,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ gap: 3 }}>
          <Typography variant="label">New entry</Typography>
          <Typography variant="title">Record money</Typography>
        </View>
      </View>
      <Card
        style={{
          alignItems: 'center',
          gap: 11,
          backgroundColor: tokens.foreground,
          paddingVertical: 24,
        }}
      >
        <Text style={{ color: tokens.background, opacity: 0.6, fontSize: 12 }}>{typeLabel}</Text>
        <Typography
          variant="display"
          style={{ color: tokens.background, fontVariant: ['tabular-nums'] }}
        >
          ₹{amount || '0.00'}
        </Typography>
        <Text style={{ color: tokens.background, opacity: 0.6, fontSize: 12 }}>INR</Text>
      </Card>
      <View style={{ gap: 14 }}>
        <Select
          label="Entry type"
          options={['expense', 'income', 'transfer']}
          value={type}
          onChange={setType}
        />
        <CurrencyInput currency="Amount in INR" value={amount} onChangeText={setAmount} />
        <AmountKeypad onDigit={(digit) => setAmount((current) => `${current}${digit}`)} />
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">Note</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <NotePencil
            size={19}
            color={tokens.mutedForeground}
            style={{ position: 'absolute', left: 14, zIndex: 1 }}
          />
          <Input
            accessibilityLabel="Transaction note"
            placeholder="What was this for?"
            value={note}
            onChangeText={setNote}
            style={{ flex: 1, paddingLeft: 44 }}
          />
        </View>
      </View>
      <Button size="lg" disabled={!amount} onPress={save}>
        <Check size={18} color={tokens.primaryForeground} strokeWidth={2.4} />
        <Text
          style={{
            color: tokens.primaryForeground,
            marginLeft: 8,
            fontFamily: 'PlusJakartaSans_600SemiBold',
          }}
        >
          Save entry
        </Text>
      </Button>
    </ScrollView>
  );
}
