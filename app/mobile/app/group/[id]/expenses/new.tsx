import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyInput } from '@/components/finance';
import { Button, IconButton, Input, Label, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { layoutTokens } from '@/lib/theme/tokens';

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
  const { userId } = useLocalSync();
  const { data: groups } = useLocalRecords<Record<string, unknown>>(userId, 'group');
  const { data: accounts } = useLocalRecords<Record<string, unknown>>(userId, 'account');
  const group = groups?.find((record) => String(record.id ?? record._id) === id);
  const account = accounts?.find((record) => record.archivedAt === undefined);

  function addMember() {
    const handle = normalizeHandle(memberInput);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || members.includes(handle)) return;
    setMembers((current) => [...current, handle]);
    setMemberInput('');
  }

  async function save() {
    const groupId = typeof group?.id === 'string'
      ? group.id
      : typeof group?._id === 'string'
        ? group._id
        : String(id ?? '');
    const accountId = typeof account?.id === 'string'
      ? account.id
      : typeof account?._id === 'string'
        ? account._id
        : undefined;
    if (!userId || !id || !group || !accountId) return;
    setError('');
    try {
      const occurredAt = Date.now();
      const amountMinor = BigInt(Math.round(Number(amount) * 100));
      await commitLocalWrite(
        userId,
        'transaction',
        'group.addExpense',
        {
          groupId,
          accountId,
          title: title.trim(),
          amountMinor,
          currency: String(group.currency ?? 'INR'),
          occurredAt,
          type: 'expense',
          participantUsernames: members,
        },
        {
          groupId,
          accountId,
          title: title.trim(),
          amountMinor,
          currency: String(group.currency ?? 'INR'),
          occurredAt,
          participantUsernames: members,
        },
        { dependencies: [`group:${groupId}`, `account:${accountId}`] },
      );
      router.replace(`/group/${id}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save group expense');
    }
  }

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
          <Typography variant="heading">Add to {String(group?.name ?? 'group')}</Typography>
        </View>
        <CurrencyInput
          currency={String(group?.currency ?? 'INR')}
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
            <Button
              variant="outline"
              onPress={addMember}
              style={{ height: layoutTokens.inputHeight }}
            >
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
        {account && <Typography variant="small">Paid from {String(account.name ?? 'Account')}</Typography>}
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
