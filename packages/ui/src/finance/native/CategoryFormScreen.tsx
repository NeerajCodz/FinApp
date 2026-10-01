import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Button, IconButton, Input, Label, Text, Typography, useTheme } from '@finapp/ui/native';
import { CategoryEmojiPicker } from './CategoryEmojiPicker';
import { EntityColorPicker } from './EntityColorPicker';
import { CategoryIcon } from './CategoryIcon';

export type CategoryFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  color?: string;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onIconChange: (value?: string) => void;
  onKindChange: (value: 'expense' | 'income') => void;
  onColorChange: (value?: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function CategoryFormScreen({
  mode,
  name,
  icon,
  kind,
  color,
  pending = false,
  error,
  onNameChange,
  onIconChange,
  onKindChange,
  onColorChange,
  onSubmit,
  onBack,
}: CategoryFormScreenProps) {
  const { tokens } = useTheme();
  const creating = mode === 'create';
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 24,
        paddingTop: 16,
        paddingBottom: 40,
        gap: 24,
        flexGrow: 1,
      }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <IconButton
        label="Back to categories"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={onBack}
      >
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <CategoryIcon label={name.trim() || 'Category'} icon={icon} />
        <View style={{ flex: 1, gap: 6 }}>
          <Typography variant="title">{creating ? 'New category' : 'Edit category'}</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            {creating
              ? 'Create a category to organize your transactions.'
              : 'Update details and preferences for this category.'}
          </Text>
        </View>
      </View>
      <View
        style={{
          gap: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 18,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="bodyLarge">Category details</Typography>
        <View style={{ gap: 8 }}>
          <Label>Name</Label>
          <Input
            accessibilityLabel="Category name"
            autoFocus
            value={name}
            onChangeText={onNameChange}
            placeholder="Enter category name"
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Label>Type</Label>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['expense', 'income'] as const).map((value) => {
              const selected = kind === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onKindChange(value)}
                  style={{
                    flex: 1,
                    minHeight: 50,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: selected
                      ? value === 'expense'
                        ? '#E5484D'
                        : tokens.primary
                      : tokens.border,
                    borderRadius: 14,
                    backgroundColor: selected ? tokens.surfaceRaised : 'transparent',
                  }}
                >
                  <Text>{value === 'expense' ? '↓  Expense' : '↗  Income'}</Text>
                  <View
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 99,
                      borderWidth: 2,
                      borderColor: selected ? tokens.primary : tokens.border,
                      backgroundColor: selected ? tokens.primary : 'transparent',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Label>Emoji / Icon</Label>
          <CategoryEmojiPicker value={icon} onChange={onIconChange} />
        </View>
        <View style={{ gap: 8 }}>
          <Label>Color (optional)</Label>
          <EntityColorPicker
            value={color}
            onChange={onColorChange}
            label={color ? 'Change color' : 'Choose color'}
          />
        </View>
      </View>
      {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button size="lg" disabled={pending || !name.trim()} onPress={onSubmit} style={{ flex: 1 }}>
          {pending ? 'Saving…' : creating ? 'Create category' : 'Save changes'}
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onPress={onBack}>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}
