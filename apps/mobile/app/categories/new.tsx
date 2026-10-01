import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CategoryFormScreen } from '@finapp/ui/finance';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';

export default function NewCategoryScreen() {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { tokens } = useTheme();
  const { userId } = useLocalSync();

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
      const record = {
        ownerId: userId,
        name: trimmedName,
        ...(icon ? { icon } : {}),
        kind,
        ...(color ? { color } : {}),
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
