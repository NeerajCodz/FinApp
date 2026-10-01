'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Input, Typography } from '@finapp/ui/web';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';

export type GoalEditorValues = {
  name: string;
  target: string;
  targetDate: string;
  icon?: string;
  color?: string;
};
export type GoalEditorProps = {
  title: string;
  screenTitle: string;
  description: string;
  currency: string;
  initial?: Partial<GoalEditorValues>;
  saving: boolean;
  error?: string;
  status?: 'loading' | 'error' | 'unavailable';
  statusMessage?: string;
  onSave?: (values: GoalEditorValues) => void;
  onCancel: () => void;
  onRetry?: () => void;
  onArchive?: () => void;
};

export function GoalEditor({
  title,
  screenTitle,
  description,
  currency,
  initial,
  saving,
  error,
  status,
  statusMessage,
  onSave,
  onCancel,
  onRetry,
  onArchive,
}: GoalEditorProps) {
  const initialName = initial?.name ?? '';
  const initialTarget = initial?.target ?? '';
  const initialDate = initial?.targetDate ?? '';
  const initialIcon = initial?.icon;
  const initialColor = initial?.color;
  const fractionDigits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency || 'USD',
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const amountStep = 10 ** -fractionDigits;
  const [name, setName] = React.useState(initialName);
  const [target, setTarget] = React.useState(initialTarget);
  const [targetDate, setTargetDate] = React.useState(initialDate);
  const [icon, setIcon] = React.useState(initialIcon);
  const [color, setColor] = React.useState(initialColor);
  React.useEffect(() => {
    setName(initialName);
    setTarget(initialTarget);
    setTargetDate(initialDate);
    setIcon(initialIcon);
    setColor(initialColor);
  }, [initialName, initialTarget, initialDate, initialIcon, initialColor]);

  return (
    <div className="finance-page" style={{ gap: 20, maxWidth: 900 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="finance-secondary-action"
          aria-label="Cancel and go back"
          onClick={onCancel}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <Typography variant="title">{screenTitle}</Typography>
          <Typography variant="small">{description}</Typography>
        </div>
      </header>
      {status ? (
        <div role={status === 'error' ? 'alert' : 'status'} style={{ display: 'grid', gap: 10 }}>
          <Typography variant="small">
            {statusMessage ??
              (status === 'loading'
                ? 'Loading goal…'
                : status === 'error'
                  ? 'Goal details could not be loaded.'
                  : 'Goal unavailable.')}
          </Typography>
          {status === 'error' && onRetry && (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave?.({ name, target, targetDate, icon, color });
          }}
          style={{
            display: 'grid',
            gap: 16,
            padding: 20,
            border: '1px solid var(--finance-line)',
            borderRadius: 18,
            background: 'var(--finapp-surface-raised)',
          }}
        >
          <Typography variant="heading">{title}</Typography>
          <EntityIconPicker mode="all" value={icon} onChange={setIcon} label="Choose goal icon" />
          <EntityColorPicker value={color} onChange={setColor} label="Goal color" />
          <label style={{ display: 'grid', gap: 6 }}>
            <Typography variant="label">Goal name</Typography>
            <Input
              aria-label="Goal name"
              value={name}
              onChangeText={setName}
              placeholder="What are you saving for?"
              required
              maxLength={80}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <Typography variant="label">
              Target amount · {currency || 'Choose a default currency'}
            </Typography>
            <Input
              aria-label="Target amount"
              value={target}
              onChangeText={setTarget}
              type="number"
              inputMode="decimal"
              min={amountStep}
              step={amountStep}
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <Typography variant="label">Target date (optional)</Typography>
            <Input
              aria-label="Target date"
              value={targetDate}
              onChangeText={setTargetDate}
              type="date"
            />
          </label>
          {error && (
            <Typography variant="small" role="alert" style={{ color: 'var(--finapp-destructive)' }}>
              {error}
            </Typography>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="button" variant="outline" onPress={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !currency || !name.trim() || !target.trim()}>
              {saving ? 'Saving…' : 'Save goal'}
            </Button>
          </div>
          {onArchive && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onPress={onArchive}
              style={{ justifySelf: 'start', color: 'var(--finapp-destructive)' }}
            >
              Archive goal
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
