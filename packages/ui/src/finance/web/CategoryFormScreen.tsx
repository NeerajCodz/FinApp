'use client';
import React from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, BarChart3 } from 'lucide-react';
import { Button, Input, Label, Select, Typography } from '@finapp/ui/web';
import { CategoryEmojiPicker } from './CategoryEmojiPicker';
import { EntityColorPicker } from './EntityColorPicker';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyInput } from './CurrencyInput';
import { formatMinor } from '../money';
import { EntityActivityTable, type EntityActivity } from './EntityActivityTable';
import { FinanceEmptyState } from './FinanceEmptyState';
import styles from './CategoryFormScreen.module.css';
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
  currency?: string;
  limitValue?: string;
  onLimitChange?: (value: string) => void;
  notes?: string;
  onNotesChange?: (value: string) => void;
  includeInBudgets?: boolean;
  onIncludeInBudgetsChange?: (value: boolean) => void;
  isDefault?: boolean;
  onDefaultChange?: (value: boolean) => void;
  spentMinor?: bigint;
  monthlyLimitMinor?: bigint;
  activity?: readonly EntityActivity[];
  onOpenTransaction?: (id: string) => void;
  onViewTransactions?: () => void;
  onOpenAnalytics?: () => void;
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
  currency = 'INR',
  limitValue = '',
  onLimitChange,
  notes = '',
  onNotesChange,
  includeInBudgets = true,
  onIncludeInBudgetsChange,
  isDefault = false,
  onDefaultChange,
  spentMinor = 0n,
  monthlyLimitMinor,
  activity = [],
  onOpenTransaction,
  onViewTransactions,
  onOpenAnalytics,
}: CategoryFormScreenProps) {
  const edit = mode === 'edit';
  const used =
    monthlyLimitMinor && monthlyLimitMinor > 0n
      ? Number((spentMinor * 100n) / monthlyLimitMinor)
      : 0;
  const settings = (
    <>
      {onDefaultChange && (
        <label className={styles.setting}>
          <input
            type="checkbox"
            role="switch"
            checked={isDefault}
            onChange={(event) => onDefaultChange(event.target.checked)}
          />
          <span>
            Set as default category
            <small>This category will be pre-selected for new {kind} transactions.</small>
          </span>
        </label>
      )}
      {onIncludeInBudgetsChange && (
        <label className={styles.setting}>
          <input
            type="checkbox"
            role="switch"
            checked={includeInBudgets}
            onChange={(event) => onIncludeInBudgetsChange(event.target.checked)}
          />
          <span>
            Include in budgets<small>Show this category in budget planning and summaries.</small>
          </span>
        </label>
      )}
    </>
  );
  return (
    <main className={styles.page}>
      <button className={styles.back} type="button" onClick={onBack}>
        <ArrowLeft size={18} /> {edit ? 'Back to categories' : 'Categories › New category'}
      </button>
      <header className={styles.header}>
        {edit && <CategoryIcon label={name} icon={icon} />}
        <div>
          <Typography variant="title">{edit ? 'Edit Category' : 'New category'}</Typography>
          <p>
            {edit
              ? 'Update details and preferences for this category.'
              : 'Create a category to organize your transactions.'}
          </p>
        </div>
      </header>
      <form
        className={edit ? styles.editLayout : styles.createLayout}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <section className={styles.panel}>
          {edit && <h2>Category details</h2>}
          <div className={edit ? styles.nameType : styles.fields}>
            <div className={styles.field}>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChangeText={onNameChange}
                placeholder="Enter category name"
                maxLength={80}
                required
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="category-kind">Type</Label>
              {edit ? (
                <Select
                  label=""
                  id="category-kind"
                  value={kind}
                  onChange={(next) => onKindChange(next as 'expense' | 'income')}
                  options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                  ]}
                />
              ) : (
                <div className={styles.segment}>
                  {(['expense', 'income'] as const).map((type) => (
                    <button
                      type="button"
                      data-kind={type}
                      aria-pressed={kind === type}
                      key={type}
                      onClick={() => onKindChange(type)}
                    >
                      {type === 'expense' ? <ArrowDown size={26} /> : <ArrowUpRight size={26} />}
                      <span>{type === 'expense' ? 'Expense' : 'Income'}</span>
                      <i />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {onLimitChange && (
            <div className={styles.field}>
              <Label>
                Monthly limit <span>(optional)</span>
              </Label>
              <CurrencyInput currency={currency} value={limitValue} onChangeText={onLimitChange} />
              {!edit && <small>Set a monthly limit to keep track of your spending.</small>}
            </div>
          )}
          {!edit && (
            <>
              <div className={styles.field}>
                <Label>Emoji / Icon</Label>
                <CategoryEmojiPicker value={icon} onChange={onIconChange} />
              </div>
              <div className={styles.field}>
                <Label>
                  Color <span>(optional)</span>
                </Label>
                <EntityColorPicker value={color} onChange={onColorChange} />
              </div>
            </>
          )}
          {onNotesChange && (
            <div className={styles.field}>
              <Label htmlFor="category-notes">
                Notes <span>(optional)</span>
              </Label>
              <textarea
                id="category-notes"
                rows={edit ? 3 : 4}
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                maxLength={200}
                placeholder="Add a note about this category…"
              />
              {edit && <small className={styles.counter}>{notes.length}/200</small>}
            </div>
          )}
          {edit && (
            <>
              <div className={styles.appearance}>
                <CategoryEmojiPicker value={icon} onChange={onIconChange} />
                <EntityColorPicker value={color} onChange={onColorChange} />
              </div>
            </>
          )}
          {!edit && (
            <div className={styles.footer}>
              <Button type="button" variant="outline" onPress={onBack}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? 'Saving…' : 'Create category'}
              </Button>
            </div>
          )}
        </section>
        {edit && (
          <aside className={styles.stack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Limit usage</h2>
                <small>
                  {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </small>
              </div>
              {monthlyLimitMinor ? (
                <>
                  <div className={styles.usage}>
                    <strong>{used}%</strong> of {formatMinor(monthlyLimitMinor, currency)}
                  </div>
                  <div className={styles.track}>
                    <span style={{ width: `${Math.min(100, used)}%` }} data-risk={used >= 80} />
                  </div>
                  <div className={styles.usageTotals}>
                    <div>
                      <strong>{formatMinor(spentMinor, currency)}</strong>
                      <small>Spent</small>
                    </div>
                    <div>
                      <strong>{formatMinor(monthlyLimitMinor - spentMinor, currency)}</strong>
                      <small>Remaining</small>
                    </div>
                  </div>
                </>
              ) : (
                <p>No monthly limit set. Add a limit to track usage.</p>
              )}
            </section>
            {onOpenAnalytics && (
              <section className={`${styles.panel} ${styles.analytics}`}>
                <BarChart3 size={29} />
                <div>
                  <h2>Category analytics</h2>
                  <p>View detailed spending trends, charts, and insights for this category.</p>
                </div>
                <Button type="button" variant="outline" onPress={onOpenAnalytics}>
                  Open analytics ↗
                </Button>
              </section>
            )}
            <section className={styles.panel}>
              <h2>Category settings</h2>
              {settings}
            </section>
          </aside>
        )}
        {edit && (
          <section className={`${styles.panel} ${styles.recent}`}>
            <div className={styles.panelHeader}>
              <h2>Recent transactions</h2>
              {onViewTransactions && (
                <Button type="button" variant="ghost" onPress={onViewTransactions}>
                  View all ›
                </Button>
              )}
            </div>
            {activity.length ? (
              <EntityActivityTable rows={activity.slice(0, 5)} onOpen={onOpenTransaction} />
            ) : (
              <FinanceEmptyState
                kind="activity"
                compact
                title="No posted transactions yet"
                description="Transactions assigned to this category will appear here."
              />
            )}
          </section>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {edit && (
          <div className={`${styles.footer} ${styles.recent}`}>
            <Button type="button" variant="outline" onPress={onBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>
    </main>
  );
}
