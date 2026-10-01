'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Input, Label, Typography, useTheme } from '@finapp/ui/web';
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
  const { tokens: themeTokens } = useTheme();
  const tokens = { ...themeTokens, surface: themeTokens.surfaceRaised };
  const creating = mode === 'create';
  return (
    <main style={{ width: 'min(100%, 920px)', margin: '0 auto', padding: '26px 24px 64px' }}>
      <Button variant="ghost" onPress={onBack} aria-label="Go back">
        <ArrowLeft size={18} /> Back to categories
      </Button>
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '28px 0 24px' }}>
        <CategoryIcon label={name.trim() || 'Category'} icon={icon} />
        <div>
          <Typography variant="title">{creating ? 'New category' : 'Edit category'}</Typography>
          <p style={{ margin: '6px 0 0', color: tokens.foregroundMuted }}>
            {creating
              ? 'Create a category to organize your transactions.'
              : 'Update details and preferences for this category.'}
          </p>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        style={{
          display: 'grid',
          gap: 18,
          maxWidth: 760,
          padding: 20,
          border: `1px solid ${tokens.border}`,
          borderRadius: 18,
          background: tokens.surface,
        }}
      >
        <Typography variant="bodyLarge">Category details</Typography>
        <div style={{ display: 'grid', gap: 8 }}>
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            autoFocus
            value={name}
            onChangeText={onNameChange}
            placeholder="Enter category name"
            maxLength={80}
            required
          />
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          <legend style={{ padding: 0, marginBottom: 8 }}>Type</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {(['expense', 'income'] as const).map((value) => {
              const selected = kind === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant={selected ? 'primary' : 'outline'}
                  aria-pressed={selected}
                  onPress={() => onKindChange(value)}
                >
                  {value === 'expense' ? '↓  Expense' : '↗  Income'}
                </Button>
              );
            })}
          </div>
        </fieldset>
        <div style={{ display: 'grid', gap: 8 }}>
          <Label>Emoji / Icon</Label>
          <CategoryEmojiPicker value={icon} onChange={onIconChange} />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Label>Color (optional)</Label>
          <EntityColorPicker
            value={color}
            onChange={onColorChange}
            label={color ? 'Change color' : 'Choose color'}
          />
        </div>
        {error && (
          <p role="alert" style={{ margin: 0, color: tokens.destructive }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : creating ? 'Create category' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onPress={onBack} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
