import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Check } from '@/lib/icons';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyInput, SettingsRow } from '@/components/finance';
import { Button, Checkbox, IconButton, Input, Separator, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from '@/lib/toast';

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').trim().toLowerCase();
}

export default function SplitExpenseScreen() {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('equal');
  const [included, setIncluded] = useState(true);
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const suggestions = useQuery(
    api.users.queries.search,
    normalizeHandle(memberInput).length >= 2 ? { query: normalizeHandle(memberInput) } : 'skip',
  );

  function addMember(value = memberInput) {
    const handle = normalizeHandle(value);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || members.includes(handle)) return;
    setMembers((current) => [...current, handle]);
    setMemberInput('');
  }

  async function save() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Split saved');
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: tokens.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 28 }}>
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
          <Tabs value={method} onChange={setMethod} tabs={[{ label: 'Equal', value: 'equal' }, { label: 'Exact', value: 'exact' }, { label: '%', value: 'percentage' }, { label: 'Shares', value: 'shares' }]} />
        </View>

        <View style={{ gap: 10 }}>
          <Typography variant="label">People</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Input accessibilityLabel="Add split participant" autoCapitalize="none" autoCorrect={false} placeholder="Add @username" value={memberInput} onChangeText={setMemberInput} onSubmitEditing={() => addMember()} style={{ flex: 1 }} />
            <Button size="icon" variant="outline" onPress={() => addMember()}>
              <Check size={18} color={tokens.foreground} />
            </Button>
          </View>
          {members.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {members.map((member) => (
                <Pressable key={member} onPress={() => setMembers((current) => current.filter((item) => item !== member))}>
                  <Typography variant="small" style={{ color: tokens.primary }}>@{member} ×</Typography>
                </Pressable>
              ))}
            </View>
          )}
          {suggestions?.map((suggestion) => (
            <Pressable key={suggestion.id} onPress={() => addMember(suggestion.username ?? '')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Typography variant="small">{suggestion.displayName} · @{suggestion.username}</Typography>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Typography variant="label">Included</Typography>
          <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Checkbox checked={included} onChange={setIncluded} label="You" />
            <Text style={{ marginLeft: 'auto', fontFamily: 'SpaceGrotesk_600SemiBold', fontVariant: ['tabular-nums'] }}>₹{amount || '0'}</Text>
          </View>
        </View>

        <Separator />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="bodyLarge">Total</Typography>
          <Typography variant="bodyLarge" style={{ fontVariant: ['tabular-nums'] }}>₹{amount || '0'}</Typography>
        </View>
        <Button size="lg" disabled={!amount || !included} onPress={save}>Save split</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
