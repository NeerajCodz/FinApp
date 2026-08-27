import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').trim().toLowerCase();
}

export default function NewGroupExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const group = useQuery(api.groups.queries.detail, id ? { groupId: id as never } : 'skip');
  const accounts = useQuery(api.accounts.queries.list);
  const addExpense = useMutation(api.groups.mutations.addExpense);
  const account = accounts?.[0];

  function addMember() {
    const handle = normalizeHandle(memberInput);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || members.includes(handle)) return;
    setMembers((current) => [...current, handle]);
    setMemberInput('');
  }

  async function save() {
    if (!id || !account || !group) return;
    setError('');
    try {
      await addExpense({
        groupId: id as never,
        accountId: account.id as never,
        title,
        amountMinor: BigInt(Math.round(Number(amount) * 100)),
        currency: group.currency,
        occurredAt: Date.now(),
        participantUsernames: members,
      });
      router.replace(`/group/${id}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save group expense');
    }
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
          <Typography variant="heading">Add to {group?.name ?? 'group'}</Typography>
        </View>
        <CurrencyInput
          currency={group?.currency ?? 'INR'}
          value={amount}
          onChangeText={setAmount}
        />
        <View>
          <Label>What was it?</Label>
          <Input
            accessibilityLabel="Group expense title"
            placeholder="Hotel, dinner, taxi"
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <View style={{ gap: 10 }}>
          <Label>Split with</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input
              accessibilityLabel="Group member username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@username"
              value={memberInput}
              onChangeText={setMemberInput}
              onSubmitEditing={addMember}
              style={{ flex: 1 }}
            />
            <Button size="sm" variant="outline" onPress={addMember}>
              Add
            </Button>
          </View>
          {members.length > 0 && (
            <Text style={{ color: tokens.primary }}>
              {members.map((member) => `@${member}`).join('  ')}
            </Text>
          )}
          <Typography variant="caption">
            You are included automatically. Add usernames already in this group.
          </Typography>
        </View>
        <Separator />
        {account && <Typography variant="small">Paid from {account.name}</Typography>}
        {!account && (
          <Typography style={{ color: tokens.destructive }}>
            Add an account before recording a group expense.
          </Typography>
        )}
        {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        <Button size="lg" disabled={!amount || !title.trim() || !account} onPress={save}>
          Save group expense
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
