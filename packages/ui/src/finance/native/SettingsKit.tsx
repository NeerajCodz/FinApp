import React from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight } from '@finapp/ui/icons/native';
import { Text, useTheme } from '@finapp/ui/native';

type Tone = 'primary' | 'positive' | 'warning' | 'danger' | 'info' | 'violet';

function useToneColor() {
  const { tokens } = useTheme();
  return (tone?: Tone) =>
    tone === 'primary'
      ? tokens.primary
      : tone === 'positive'
        ? tokens.positive
        : tone === 'warning'
          ? tokens.warning
          : tone === 'danger'
            ? tokens.expense
            : tone === 'info'
              ? tokens.chart.blue
              : tone === 'violet'
                ? tokens.chart.violet
                : tokens.foreground;
}

/** Settings screen frame: safe area, back button, title, actions; two columns on tablets. */
export function SettingsScreen({
  title,
  subtitle,
  onBack,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const twoColumn = width >= 820;
  const items = React.Children.toArray(children);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 32,
        gap: 16,
        width: '100%',
        maxWidth: twoColumn ? 1080 : 720,
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack ? (
          <SettingsIconButton label="Go back" onPress={onBack}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </SettingsIconButton>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              color: tokens.foreground,
              fontSize: 28,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              letterSpacing: -0.8,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions}
      </View>
      {twoColumn ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {items.map((child, index) => (
            <View key={index} style={{ flexBasis: '48%', flexGrow: 1 }}>
              {child}
            </View>
          ))}
        </View>
      ) : (
        items
      )}
    </ScrollView>
  );
}

export function SettingsIconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function SettingsGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.card,
        overflow: 'hidden',
      }}
    >
      {title || description ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 2 }}>
          {title ? (
            <Text
              style={{
                color: tokens.foregroundMuted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}
            >
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>{description}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
        {rows.map((row, index) => (
          <View
            key={index}
            style={index ? { borderTopWidth: 1, borderTopColor: tokens.borderSubtle } : undefined}
          >
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

function RowIcon({ icon, tone }: { icon?: React.ReactNode; tone?: Tone }) {
  const { tokens } = useTheme();
  const color = useToneColor()(tone);
  if (!icon) return null;
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone ? `${color}26` : tokens.surfaceSubtle,
      }}
    >
      {icon}
    </View>
  );
}

const rowStyle: ViewStyle = {
  minHeight: 60,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 14,
};

function RowText({
  title,
  description,
  danger,
}: {
  title: string;
  description?: string;
  danger?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text
        style={{
          color: danger ? tokens.expense : tokens.foreground,
          fontSize: 15,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text style={{ color: tokens.foregroundMuted, fontSize: 12, lineHeight: 16 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function SettingsLink({
  icon,
  tone,
  title,
  description,
  value,
  danger,
  onPress,
}: {
  /** Pass an icon already coloured for `tone` (use `settingsToneColor`). */
  icon?: React.ReactNode;
  tone?: Tone;
  title: string;
  description?: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        rowStyle,
        pressed && onPress ? { backgroundColor: tokens.surfaceSubtle } : null,
      ]}
    >
      <RowIcon icon={icon} tone={danger ? 'danger' : tone} />
      <RowText title={title} description={description} danger={danger} />
      {value ? (
        <Text
          numberOfLines={1}
          style={{ maxWidth: '38%', color: tokens.foregroundMuted, fontSize: 13 }}
        >
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? <CaretRight size={18} color={tokens.foregroundSubtle} /> : null}
    </Pressable>
  );
}

export function SettingsSwitch({
  icon,
  tone,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon?: React.ReactNode;
  tone?: Tone;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[rowStyle, disabled ? { opacity: 0.55 } : null]}
    >
      <RowIcon icon={icon} tone={tone} />
      <RowText title={title} description={description} />
      <Switch
        value={checked}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: tokens.surfaceSubtle, true: tokens.primary }}
        thumbColor={checked ? tokens.primaryForeground : tokens.foreground}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

export function SettingsChoice<T extends string>({
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ padding: 12, gap: 10, opacity: disabled ? 0.55 : 1 }}>
      <RowText title={title} description={description} />
      <View
        accessibilityRole="radiogroup"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          padding: 4,
          borderRadius: 14,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={{
                flexGrow: 1,
                minHeight: 36,
                paddingHorizontal: 12,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? tokens.card : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: tokens.borderSubtle,
              }}
            >
              <Text
                style={{
                  color: active ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Horizontal chip picker for longer option lists (e.g. languages). */
export function SettingsChips<T extends string>({
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ paddingVertical: 12, gap: 10, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ paddingHorizontal: 12 }}>
        <RowText title={title} description={description} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={{
                height: 34,
                paddingHorizontal: 12,
                borderRadius: 17,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: active ? tokens.primary : tokens.borderSubtle,
                backgroundColor: active ? `${tokens.primary}22` : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SettingsTextArea({
  title,
  description,
  value,
  placeholder,
  maxLength,
  disabled,
  onSave,
}: {
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  onSave: (next: string) => Promise<unknown> | void;
}) {
  const { tokens } = useTheme();
  const [draft, setDraft] = React.useState(value);
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  React.useEffect(() => setDraft(value), [value]);
  const dirty = draft !== value;
  const save = async () => {
    if (!dirty) return;
    setState('saving');
    try {
      await onSave(draft);
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  };
  return (
    <View style={{ padding: 12, gap: 8, opacity: disabled ? 0.55 : 1 }}>
      <RowText title={title} description={description} />
      <TextInput
        multiline
        value={draft}
        editable={!disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={tokens.foregroundSubtle}
        onChangeText={setDraft}
        onBlur={() => void save()}
        accessibilityLabel={title}
        style={{
          minHeight: 96,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
          color: tokens.foreground,
          fontSize: 14,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>
          {draft.length}/{maxLength}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!dirty || disabled}
          onPress={() => void save()}
          style={{
            height: 32,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            justifyContent: 'center',
            opacity: !dirty || disabled ? 0.5 : 1,
          }}
        >
          <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: '600' }}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SettingsHero({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${tokens.primary}55`,
        backgroundColor: tokens.card,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${tokens.primary}26`,
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 180 }}>
        <RowText title={title} description={description} />
      </View>
      {action}
    </View>
  );
}

/** The icon colour for a row tone (for icons passed into rows). */
export function useSettingsToneColor() {
  return useToneColor();
}
