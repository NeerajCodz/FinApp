import React from 'react';
import { View } from 'react-native';
import { Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import type { GoalEditorProps, GoalEditorValues } from '../web/GoalEditor';
import { formatMinor } from '../money';

export type { GoalEditorProps, GoalEditorValues } from '../web/GoalEditor';

export function GoalEditor(p: GoalEditorProps) {
  const { tokens } = useTheme();
  const [values, setValues] = React.useState<GoalEditorValues>({
    name: '',
    target: '',
    targetDate: '',
    priority: 'low',
    reminderFrequency: 'monthly',
    ...p.initial,
  });
  const initialKey = JSON.stringify(p.initial);
  React.useEffect(() => {
    setValues({
      name: '',
      target: '',
      targetDate: '',
      priority: 'low',
      reminderFrequency: 'monthly',
      ...p.initial,
    });
  }, [initialKey]);
  const set = <K extends keyof GoalEditorValues>(key: K, value: GoalEditorValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const editing = Boolean(p.onArchive) || p.screenTitle.toLowerCase().includes('edit');
  const panel = {
    gap: 13,
    padding: 18,
    borderWidth: 1 as const,
    borderColor: tokens.borderSubtle,
    borderRadius: 16,
    backgroundColor: tokens.surfaceRaised,
  };
  if (p.status)
    return (
      <View style={{ gap: 10 }}>
        <Typography variant="title">{p.screenTitle}</Typography>
        <Text style={{ color: p.status === 'error' ? tokens.destructive : tokens.foregroundMuted }}>
          {p.statusMessage ??
            (p.status === 'loading'
              ? 'Loading goal…'
              : p.status === 'error'
                ? 'Goal details could not be loaded.'
                : 'Goal unavailable.')}
        </Text>
        {p.status === 'error' && p.onRetry && (
          <Button variant="outline" onPress={p.onRetry}>
            Retry
          </Button>
        )}
      </View>
    );

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Typography variant="title">{p.screenTitle}</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>{p.description}</Text>
      </View>
      <View style={panel}>
        <Typography variant="heading">{p.title}</Typography>
        <EntityIconPicker
          mode="all"
          value={values.icon}
          onChange={(icon) => set('icon', icon)}
          label={editing ? 'Change icon' : 'Choose icon'}
        />
        <EntityColorPicker
          value={values.color}
          onChange={(color) => set('color', color)}
          label="Goal color"
        />
        <Typography variant="label">Goal name</Typography>
        <Input
          accessibilityLabel="Goal name"
          placeholder="e.g. Europe Trip, Emergency Fund"
          value={values.name}
          onChangeText={(name) => set('name', name)}
          maxLength={80}
        />
        <Typography variant="label">Goal type</Typography>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {['Emergency Fund', 'Travel', 'Gadget', 'Education', 'House', 'Other'].map((type) => (
            <Button
              key={type}
              size="sm"
              variant={values.goalType === type ? 'secondary' : 'outline'}
              onPress={() => set('goalType', values.goalType === type ? undefined : type)}
            >
              {type}
            </Button>
          ))}
        </View>
        <Typography variant="label">Target amount · {p.currency}</Typography>
        <Input
          accessibilityLabel={`Target amount in ${p.currency}`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={values.target}
          onChangeText={(target) => set('target', target)}
        />
        <Typography variant="label">Target date (optional)</Typography>
        <Input
          accessibilityLabel="Target date"
          placeholder="YYYY-MM-DD"
          value={values.targetDate}
          onChangeText={(targetDate) => set('targetDate', targetDate)}
        />
        <Typography variant="label">Current saved amount · {p.currency}</Typography>
        {editing ? (
          <Text>{formatMinor(p.saved ?? 0n, p.currency || 'INR')}</Text>
        ) : (
          <Input
            accessibilityLabel={`Current saved amount in ${p.currency}`}
            placeholder="0"
            keyboardType="decimal-pad"
            value={values.initialSaved ?? ''}
            onChangeText={(initialSaved) => set('initialSaved', initialSaved)}
          />
        )}
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          {editing
            ? 'Change saved progress by recording contributions.'
            : 'This creates an opening contribution on the goal.'}
        </Typography>
        <Typography variant="label">Monthly contribution · {p.currency}</Typography>
        <Input
          accessibilityLabel={`Monthly contribution in ${p.currency}`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={values.monthlyContribution ?? ''}
          onChangeText={(monthlyContribution) => set('monthlyContribution', monthlyContribution)}
        />
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          Planned amount only; transfers are manual.
        </Typography>
        <Typography variant="label">Linked account</Typography>
        <Button
          size="sm"
          variant={!values.accountId ? 'secondary' : 'outline'}
          onPress={() => set('accountId', undefined)}
        >
          No linked account
        </Button>
        {(p.accounts ?? []).map((account) => (
          <Button
            key={account.id}
            size="sm"
            variant={values.accountId === account.id ? 'secondary' : 'outline'}
            onPress={() => set('accountId', account.id)}
          >
            {account.name}
          </Button>
        ))}
        <Typography variant="label">Priority</Typography>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {(['low', 'medium', 'high'] as const).map((priority) => (
            <Button
              key={priority}
              size="sm"
              style={{ flex: 1 }}
              variant={values.priority === priority ? 'secondary' : 'outline'}
              onPress={() => set('priority', priority)}
            >
              {priority[0]!.toUpperCase() + priority.slice(1)}
            </Button>
          ))}
        </View>
        <Typography variant="label">Reminder frequency</Typography>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {(['none', 'weekly', 'monthly'] as const).map((frequency) => (
            <Button
              key={frequency}
              size="sm"
              style={{ flex: 1 }}
              variant={values.reminderFrequency === frequency ? 'secondary' : 'outline'}
              onPress={() => set('reminderFrequency', frequency)}
            >
              {frequency[0]!.toUpperCase() + frequency.slice(1)}
            </Button>
          ))}
        </View>
        <Typography variant="label">Notes (optional)</Typography>
        <Input
          accessibilityLabel="Goal notes"
          multiline
          maxLength={500}
          placeholder="Add details, motivations, or notes for this goal."
          value={values.notes ?? ''}
          onChangeText={(notes) => set('notes', notes)}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Text style={{ color: tokens.foregroundMuted, textAlign: 'right' }}>
          {values.notes?.length ?? 0}/500
        </Text>
        {!!p.error && (
          <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {p.error}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onPress={p.onCancel}>
            Cancel
          </Button>
          <Button
            style={{ flex: 1 }}
            disabled={p.saving || !p.currency || !values.name.trim() || !values.target.trim()}
            onPress={() => {
              if (values.name.trim() && values.target.trim() && p.currency)
                p.onSave?.(values);
            }}
          >
            {p.saving ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}
          </Button>
        </View>
        {p.onArchive && (
          <Button variant="outline" disabled={p.saving} onPress={p.onArchive}>
            <Text style={{ color: tokens.destructive }}>Archive goal</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
