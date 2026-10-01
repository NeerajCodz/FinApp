'use client';

import { ArrowLeft } from 'lucide-react';
import { Button, Input, Label, Typography, useTheme } from '@finapp/ui/web';
import { CategoryIcon } from './CategoryIcon';

export type BudgetCategoryOption = { id: string; name: string; icon?: string };
export type BudgetFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  amount: string;
  currency: string;
  categoryId: string;
  categories: readonly BudgetCategoryOption[];
  startDate: string;
  endDate: string;
  loading?: boolean;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function BudgetFormScreen(props: BudgetFormScreenProps) {
  const { tokens: themeTokens } = useTheme();
  const tokens = { ...themeTokens, surface: themeTokens.surfaceRaised };
  const creating = props.mode === 'create';
  return (
    <main style={{ width: 'min(100%, 1040px)', margin: '0 auto', padding: '26px 24px 64px' }}>
      <Button variant="ghost" onPress={props.onBack} aria-label="Go back">
        <ArrowLeft size={18} /> Back to budgets
      </Button>
      <header style={{ margin: '28px 0 24px' }}>
        <Typography variant="title">{creating ? 'New budget' : 'Edit budget'}</Typography>
        <p style={{ color: tokens.foregroundMuted }}>
          Set a category spending limit and review real expenses against it.
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
        style={{
          display: 'grid',
          gap: 18,
          maxWidth: 760,
          padding: 22,
          border: `1px solid ${tokens.border}`,
          borderRadius: 18,
          background: tokens.surface,
        }}
      >
        <Typography variant="bodyLarge">Budget details</Typography>
        {props.loading ? (
          <p role="status">Loading categories and currency…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              <Label htmlFor="budget-name">Budget name</Label>
              <Input
                id="budget-name"
                value={props.name}
                onChangeText={props.onNameChange}
                maxLength={80}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <Label htmlFor="budget-limit">Spending limit ({props.currency})</Label>
              <Input
                id="budget-limit"
                inputMode="decimal"
                value={props.amount}
                onChangeText={props.onAmountChange}
                required
              />
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              <legend style={{ marginBottom: 10 }}>Category</legend>
              {props.categories.length ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                    gap: 10,
                  }}
                >
                  {props.categories.map((category) => (
                    <Button
                      key={category.id}
                      type="button"
                      variant={props.categoryId === category.id ? 'primary' : 'outline'}
                      aria-pressed={props.categoryId === category.id}
                      onPress={() => props.onCategoryChange(category.id)}
                    >
                      <CategoryIcon label={category.name} icon={category.icon} /> {category.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p>No available categories. Create a category first.</p>
              )}
            </fieldset>
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <Label htmlFor="budget-start">Starts (UTC)</Label>
                <Input
                  id="budget-start"
                  type="date"
                  value={props.startDate}
                  onChangeText={props.onStartDateChange}
                  required
                />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Label htmlFor="budget-end">Ends (exclusive, UTC)</Label>
                <Input
                  id="budget-end"
                  type="date"
                  value={props.endDate}
                  onChangeText={props.onEndDateChange}
                  required
                />
              </div>
            </div>
          </>
        )}
        {props.error && (
          <p role="alert" style={{ color: tokens.destructive }}>
            {props.error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            type="submit"
            disabled={props.loading || props.pending || !props.name.trim() || !props.categoryId}
          >
            {props.pending ? 'Saving…' : creating ? 'Create budget' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" disabled={props.pending} onPress={props.onBack}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
