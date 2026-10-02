import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CategoryFormScreen } from '@finapp/ui/finance';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';

import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { parseMinor } from '@/lib/money';
export default function NewCategoryScreen() {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { tokens } = useTheme();
  const { userId } = useLocalSync();
  const { data: profiles = [] } = useLocalRecords<LocalRecord>(userId, 'profile');
  const currency = String(profiles[0]?.defaultCurrency ?? 'INR');
  const [limitValue, setLimitValue] = useState('');
  const [notes, setNotes] = useState('');

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName || pending) return;
    if (!userId) {
      setError('Sign in to create a category.');
      return;
    }
    if (icon !== undefined && (icon.length === 0 || icon.length > 32)) {
      setError('Choose a valid category emoji.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const now = Date.now();
      const monthlyLimitMinor = limitValue.trim() ? parseMinor(limitValue, currency) : undefined;
      if (monthlyLimitMinor !== undefined && monthlyLimitMinor <= 0n) throw new Error('Enter a positive monthly limit.');
      const record = {
        ownerId: userId,
        name: trimmedName,
        ...(icon ? { icon } : {}),
        kind,
        ...(color ? { color } : {}),
        notes: notes.trim() || undefined,
        ...(monthlyLimitMinor !== undefined ? { monthlyLimitMinor, limitCurrency: currency } : {}),
        isSystem: false,
        sortOrder: now,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'category', 'category.create', record, {
        name: trimmedName,
        ...(icon ? { icon } : {}),
        kind,
        ...(color ? { color } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(monthlyLimitMinor !== undefined ? { monthlyLimitMinor, limitCurrency: currency } : {}),
      });
      router.replace(`/category/${id}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create category.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background, paddingTop: 8 }}>
      <CategoryFormScreen
        mode="create"
        name={name}
        icon={icon}
        kind={kind}
        color={color}
        currency={currency}
        limitValue={limitValue}
        onLimitChange={setLimitValue}
        notes={notes}
        onNotesChange={setNotes}
        pending={pending}
        error={error}
        onNameChange={setName}
        onIconChange={setIcon}
        onKindChange={setKind}
        onColorChange={setColor}
        onSubmit={() => void save()}
        onBack={() => router.back()}
      />
    </View>
  );
}
