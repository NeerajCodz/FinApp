import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CategoryFormScreen } from '@finapp/ui/finance';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  kind?: 'expense' | 'income';
  color?: string;
  isSystem?: boolean;
  archivedAt?: number;
  updatedAt?: number;
};

export default function EditCategoryScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { userId } = useLocalSync();
  const state = useLocalRecords<Category>(userId, 'category');
  const { tokens } = useTheme();
  const category = (state.data ?? []).find(
    (record) =>
      (typeof record.ownerId !== 'string' || record.ownerId === userId) &&
      [record.id, record._id, record.cloudId].includes(routeId ?? ''),
  );
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setName(category?.name ?? '');
    setIcon(category?.icon);
    setKind(category?.kind === 'income' ? 'income' : 'expense');
    setColor(category?.color);
  }, [
    category?.id,
    category?._id,
    category?.name,
    category?.icon,
    category?.kind,
    category?.color,
  ]);

  async function save() {
    const trimmed = name.trim();
    if (!userId || !category || pending || !trimmed) return;
    const categoryId = String(category._id ?? category.cloudId ?? category.id ?? '');
    if (!categoryId) {
      setError('This category cannot be updated yet.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const recordId = String(category.id ?? category._id ?? categoryId);
      const dependencies = categoryId.startsWith('local-') ? [`category:${categoryId}`] : [];
      const options = { recordId, dependencies, baseUpdatedAt: category.updatedAt };
      if (trimmed !== (category.name ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.rename',
          { ...category, name: trimmed },
          { categoryId, name: trimmed },
          options,
        );
      }
      if ((icon ?? '') !== (category.icon ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.setIcon',
          { ...category, icon },
          { categoryId, icon: icon ?? null },
          options,
        );
      }
      if (kind !== (category.kind ?? 'expense') || (color ?? '') !== (category.color ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.setPreferences',
          { ...category, kind, color },
          { categoryId, kind, color: color ?? null },
          options,
        );
      }
      router.replace(`/category/${encodeURIComponent(routeId ?? categoryId)}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this category.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          backgroundColor: tokens.background,
        }}
      >
        <Typography>Sign in to edit a private category.</Typography>
      </View>
    );
  if (state.loading)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          backgroundColor: tokens.background,
        }}
      >
        <Typography>Loading category…</Typography>
      </View>
    );
  if (state.error)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          gap: 16,
          backgroundColor: tokens.background,
        }}
      >
        <Typography style={{ color: tokens.destructive }}>
          Category could not be opened: {String(state.error)}
        </Typography>
        <Button onPress={() => router.back()}>Go back</Button>
      </View>
    );
  if (!category || category.archivedAt !== undefined || category.isSystem)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          gap: 16,
          backgroundColor: tokens.background,
        }}
      >
        <Typography variant="title">Category unavailable</Typography>
        <Typography>This category could not be found or cannot be edited.</Typography>
        <Button onPress={() => router.replace('/categories' as never)}>Back to categories</Button>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <CategoryFormScreen
        mode="edit"
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
