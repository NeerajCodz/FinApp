import React from 'react';
import { View } from 'react-native';
import { Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import type { GoalEditorProps, GoalEditorValues } from '../web/GoalEditor';

export type { GoalEditorProps, GoalEditorValues } from '../web/GoalEditor';

export function GoalEditor({
  screenTitle,
  description,
  title,
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
  const { tokens } = useTheme();
  const initialName = initial?.name ?? '';
  const initialTarget = initial?.target ?? '';
  const initialDate = initial?.targetDate ?? '';
  const initialIcon = initial?.icon;
  const initialColor = initial?.color;
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
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Typography variant="title">{screenTitle}</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>{description}</Text>
      </View>
      {status ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: status === 'error' ? tokens.destructive : tokens.foregroundMuted }}>
            {statusMessage ??
              (status === 'loading'
                ? 'Loading goal…'
                : status === 'error'
                  ? 'Goal details could not be loaded.'
                  : 'Goal unavailable.')}
          </Text>
          {status === 'error' && onRetry && (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          )}
        </View>
      ) : (
        <View
          style={{
            gap: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 18,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <Typography variant="heading">{title}</Typography>
          <EntityIconPicker mode="all" value={icon} onChange={setIcon} label="Choose goal icon" />
          <EntityColorPicker value={color} onChange={setColor} label="Goal color" />
          <Input
            accessibilityLabel="Goal name"
            placeholder="What are you saving for?"
            value={name}
            onChangeText={setName}
          />
          <Input
            accessibilityLabel={`Target amount in ${currency}`}
            placeholder={`Target amount · ${currency || 'Set default currency'}`}
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
          />
          <Input
            accessibilityLabel="Target date, optional"
            placeholder="Target date · YYYY-MM-DD (optional)"
            value={targetDate}
            onChangeText={setTargetDate}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {error}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button variant="outline" style={{ flex: 1 }} onPress={onCancel}>
              Cancel
            </Button>
            <Button
              style={{ flex: 1 }}
              disabled={saving || !currency || !name.trim() || !target.trim()}
              onPress={() => {
                if (name.trim() && target.trim() && currency)
                  onSave?.({ name, target, targetDate, icon, color });
              }}
            >
              {saving ? 'Saving…' : 'Save goal'}
            </Button>
          </View>
          {onArchive && (
            <Button variant="outline" disabled={saving} onPress={onArchive}>
              <Text style={{ color: tokens.destructive }}>Archive goal</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
