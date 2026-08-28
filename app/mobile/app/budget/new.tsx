import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyInput } from '@/components/finance';
import { Button, IconButton, Input, Label, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function NewBudgetScreen() {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [scope, setScope] = useState('monthly');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          <Typography variant="heading">New budget</Typography>
        </View>

        <View style={{ gap: 10 }}>
          <Typography variant="title">Give every rupee{`\n`}a boundary.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
            Choose a limit. Finapp will make what remains obvious.
          </Text>
        </View>

        <CurrencyInput currency="INR" value={limit} onChangeText={setLimit} />

        <View style={{ gap: 10 }}>
          <Label>Scope</Label>
          <Tabs
            value={scope}
            onChange={setScope}
            tabs={[
              { label: 'Monthly', value: 'monthly' },
              { label: 'Category', value: 'category' },
              { label: 'Account', value: 'account' },
            ]}
          />
        </View>

        <View>
          <Label>Name</Label>
          <Input
            accessibilityLabel="Budget name"
            placeholder="Monthly spending"
            value={name}
            onChangeText={setName}
          />
        </View>

        <Button
          size="lg"
          disabled={!name.trim() || !limit || Number(limit) <= 0}
          onPress={() => router.back()}
        >
          Save budget
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
