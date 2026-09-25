import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from '@/components/finance';
import { CategoryEmojiPicker } from '@/components/finance/CategoryEmojiPicker';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';

export default function NewCategoryScreen() {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
    setError('');
    try {
      const now = Date.now();
      const id = await commitLocalWrite(
        userId,
        'category',
        'category.create',
        {
          ownerId: userId,
          name: trimmedName,
          ...(icon ? { icon } : {}),
          isSystem: false,
          sortOrder: now,
          createdAt: now,
          updatedAt: now,
        },
        { name: trimmedName, ...(icon ? { icon } : {}) },
      );
      router.replace(`/category/${id}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create category.');
    } finally {
      setPending(false);
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
          gap: 30,
          flexGrow: 1,
        }}
      >
        <IconButton label="Go back" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>

        <View style={{ flex: 1, justifyContent: 'center', gap: 30 }}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CategoryIcon label={name.trim() || 'Category'} icon={icon} />
              <Typography variant="title" style={{ flex: 1 }} numberOfLines={1}>
                {name.trim() || 'New category'}
              </Typography>
            </View>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
              Give your money a place to belong.
            </Text>
            <CategoryEmojiPicker value={icon} onChange={setIcon} />
          </View>
          <View style={{ gap: 20 }}>
            <View>
              <Label>Name</Label>
              <Input
                accessibilityLabel="Category name"
                autoFocus
                value={name}
                onChangeText={setName}
                placeholder="Groceries"
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
          </View>
        </View>

        {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        <Button size="lg" disabled={!name.trim() || pending} onPress={save}>
          {pending ? 'Saving…' : 'Create category'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
