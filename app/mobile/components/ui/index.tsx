import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Switch as NativeSwitch,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { getTouchTargetStyle } from './touch-target';
import { useTheme } from '@/providers/ThemeProvider';
import { Check } from '@/lib/icons';

export function Text({ children, style, ...props }: React.ComponentProps<typeof RNText>) {
  const { tokens } = useTheme();
  return (
    <RNText
      allowFontScaling
      style={[
        {
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_400Regular',
          fontSize: 15,
          lineHeight: 22,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export const Typography = ({
  children,
  variant = 'body',
  ...props
}: React.ComponentProps<typeof RNText> & {
  variant?:
    | 'hero'
    | 'display'
    | 'title'
    | 'heading'
    | 'bodyLarge'
    | 'body'
    | 'small'
    | 'caption'
    | 'label';
}) => {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        variant === 'hero' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 48,
          lineHeight: 52,
          letterSpacing: -2,
          fontVariant: ['tabular-nums'],
        },
        variant === 'display' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 36,
          lineHeight: 40,
          letterSpacing: -1.3,
        },
        variant === 'title' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 30,
          lineHeight: 34,
          letterSpacing: -0.9,
        },
        variant === 'heading' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 20,
          lineHeight: 25,
          letterSpacing: -0.3,
        },
        variant === 'bodyLarge' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 17,
          lineHeight: 24,
        },
        variant === 'small' && {
          fontSize: 13,
          lineHeight: 18,
          color: tokens.foregroundMuted,
        },
        variant === 'caption' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 11,
          lineHeight: 15,
          letterSpacing: 0.2,
          color: tokens.foregroundSubtle,
        },
        variant === 'label' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 13,
          lineHeight: 18,
          color: tokens.foregroundMuted,
        },
        props.style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

type ButtonProps = Omit<PressableProps, 'children'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  children: React.ReactNode;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  style,
  accessibilityLabel,
  disabled,
  ...props
}: ButtonProps) {
  const { tokens } = useTheme();
  const colors = {
    primary: { backgroundColor: tokens.primary, color: tokens.primaryForeground },
    secondary: { backgroundColor: tokens.secondary, color: tokens.secondaryForeground },
    outline: { backgroundColor: 'transparent', color: tokens.foreground },
    ghost: { backgroundColor: 'transparent', color: tokens.foregroundMuted },
    destructive: { backgroundColor: '#FF5C5C1A', color: tokens.destructive },
  } as const;
  const { backgroundColor, color } = colors[variant];
  const compact = size === 'sm';
  const icon = size === 'icon';
  const baseStyle = getTouchTargetStyle({
    minWidth: icon ? 44 : undefined,
    borderRadius: 14,
    paddingHorizontal: icon ? 0 : compact ? 14 : 18,
    paddingVertical: icon ? 0 : compact ? 8 : 14,
    minHeight: icon ? 44 : compact ? 38 : size === 'lg' ? 54 : 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor,
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: variant === 'outline' ? tokens.border : 'transparent',
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        baseStyle,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.88 },
        disabled && { opacity: 0.32 },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text
          numberOfLines={1}
          style={{
            color,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: compact ? 13 : 15,
            lineHeight: compact ? 18 : 20,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton({
  children,
  label,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'children'> & { children: React.ReactNode; label: string }) {
  return (
    <Button accessibilityLabel={label} size="icon" variant={variant} {...props}>
      {children}
    </Button>
  );
}

export function Card({
  children,
  style,
  variant = 'default',
  ...props
}: ViewProps & { variant?: 'default' | 'subtle' | 'outline' }) {
  const { tokens } = useTheme();
  const backgroundColor =
    variant === 'outline'
      ? 'transparent'
      : variant === 'subtle'
        ? tokens.surfaceSubtle
        : tokens.card;
  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: 18,
          padding: 18,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: tokens.borderSubtle,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function Input({
  style,
  onFocus,
  onBlur,
  error = false,
  ...props
}: TextInputProps & { error?: boolean }) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={tokens.foregroundDisabled}
      selectionColor={tokens.primary}
      cursorColor={tokens.primary}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        {
          minHeight: 56,
          borderWidth: 1,
          borderColor: error ? tokens.destructive : focused ? tokens.ring : tokens.borderSubtle,
          borderRadius: 14,
          paddingHorizontal: 16,
          color: tokens.foreground,
          backgroundColor: focused ? tokens.surfaceRaised : tokens.input,
          fontFamily: 'SpaceGrotesk_400Regular',
          fontSize: 15,
          lineHeight: 22,
        },
        style,
      ]}
      {...props}
    />
  );
}

export const Label = ({ children, ...props }: React.ComponentProps<typeof RNText>) => (
  <Typography variant="label" {...props} style={[{ marginBottom: 8 }, props.style]}>
    {children}
  </Typography>
);

export function Badge({
  children,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> & {
  variant?: 'default' | 'success' | 'danger' | 'neutral';
}) {
  const { tokens } = useTheme();
  const palette = {
    default: { backgroundColor: tokens.primary, color: tokens.primaryForeground },
    success: { backgroundColor: '#B7FF4A1A', color: tokens.positive },
    danger: { backgroundColor: '#FF5C5C1A', color: tokens.destructive },
    neutral: { backgroundColor: tokens.surfaceRaised, color: tokens.foregroundMuted },
  } as const;
  return (
    <Text
      {...props}
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: palette[variant].backgroundColor,
          color: palette[variant].color,
          fontSize: 11,
          lineHeight: 15,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          letterSpacing: 0.2,
        },
        props.style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Avatar({
  initials,
  label,
  size = 42,
}: {
  initials: string;
  label?: string;
  size?: number;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label ?? initials}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.surfaceRaised,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: size * 0.32,
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Typography variant="heading">{title}</Typography>
      {action}
    </View>
  );
}

export function Separator() {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={{ height: 1, backgroundColor: tokens.borderSubtle, width: '100%' }}
    />
  );
}

export function Progress({
  value,
  color,
  height = 6,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const { tokens } = useTheme();
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: normalized }}
      style={{ height, borderRadius: height / 2, backgroundColor: tokens.borderSubtle, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${normalized}%`,
          height: '100%',
          backgroundColor: color ?? tokens.foreground,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        getTouchTargetStyle({ flexDirection: 'row', alignItems: 'center', gap: 10 }),
        pressed && { opacity: 0.88 },
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: checked ? tokens.primary : tokens.border,
          backgroundColor: checked ? tokens.primary : tokens.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Check size={15} strokeWidth={2.4} color={tokens.background} />}
      </View>
      <Text>{label}</Text>
    </Pressable>
  );
}

export function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={getTouchTargetStyle({ flexDirection: 'row', alignItems: 'center', gap: 10 })}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: option.value === value ? tokens.primary : tokens.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {option.value === value && (
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.primary }}
              />
            )}
          </View>
          <Text>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Switch = ({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) => {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 56,
      }}
    >
      <Label style={{ marginBottom: 0, color: tokens.foreground }}>{label}</Label>
      <NativeSwitch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: tokens.border, true: tokens.primary }}
        thumbColor={value ? tokens.background : tokens.foregroundMuted}
      />
    </View>
  );
};

export const Tabs = ({
  tabs,
  value,
  onChange,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        backgroundColor: tokens.surfaceRaised,
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Button
            key={tab.value}
            size="sm"
            variant={selected ? 'secondary' : 'ghost'}
            onPress={() => onChange(tab.value)}
            style={{ flex: 1, borderRadius: 10 }}
          >
            {tab.label}
          </Button>
        );
      })}
    </View>
  );
};

export const Select = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
}) => (
  <View>
    <Label>{label}</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === value ? 'primary' : 'outline'}
          onPress={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </View>
  </View>
);

export const Popover = ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
  visible ? <Card>{children}</Card> : null;

export function Sheet({
  visible,
  onClose,
  children,
  title = 'Actions',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close sheet"
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: tokens.overlay }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: tokens.popover,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 28,
            gap: 16,
            borderTopWidth: 1,
            borderColor: tokens.borderSubtle,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.55,
            shadowRadius: 40,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: tokens.foregroundDisabled,
              alignSelf: 'center',
              marginBottom: 4,
            }}
          />
          <Typography variant="heading" style={{ fontSize: 22, lineHeight: 27 }}>
            {title}
          </Typography>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

export const Dialog = Sheet;
export const AlertDialog = Sheet;
export const Drawer = Sheet;
export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);
export const Calendar = ({ label = 'Calendar' }: { label?: string }) => (
  <Card>
    <Text accessibilityRole="header">{label}</Text>
  </Card>
);

export function Skeleton({
  width = '100%',
  height = 18,
}: {
  width?: number | `${number}%`;
  height?: number;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Loading"
      style={{ width, height, borderRadius: 10, backgroundColor: tokens.surfaceRaised }}
    />
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Empty state"
      style={{ alignItems: 'flex-start', gap: 10, paddingVertical: 24 }}
    >
      <Typography variant="heading">{title}</Typography>
      {description && (
        <Text style={{ color: tokens.foregroundMuted, lineHeight: 22, maxWidth: 280 }}>
          {description}
        </Text>
      )}
      {action && <View style={{ marginTop: 6 }}>{action}</View>}
    </View>
  );
}

export const ScrollArea = ({ children, ...props }: React.ComponentProps<typeof ScrollView>) => (
  <ScrollView {...props}>{children}</ScrollView>
);

export function Slider({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      onPress={() => onValueChange(value >= 100 ? 0 : value + 10)}
      style={{ height: 9, backgroundColor: tokens.muted, borderRadius: 5 }}
    >
      <View
        style={{
          width: `${value}%`,
          height: '100%',
          backgroundColor: tokens.primary,
          borderRadius: 5,
        }}
      />
    </Pressable>
  );
}

export const Textarea = (props: TextInputProps) => (
  <Input
    multiline
    textAlignVertical="top"
    {...props}
    style={[{ minHeight: 100, paddingTop: 14 }, props.style]}
  />
);
export function InputOTP({
  value,
  onChangeText,
  length = 6,
}: {
  value: string;
  onChangeText: (v: string) => void;
  length?: number;
}) {
  const { tokens } = useTheme();
  const inputRef = React.useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length }, (_, index) => value[index] ?? '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enter six-digit verification code"
      onPress={() => inputRef.current?.focus()}
      style={{ position: 'relative' }}
    >
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
        {cells.map((character, index) => {
          const active = focused && index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              style={{
                width: 48,
                height: 56,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? tokens.ring : tokens.borderSubtle,
                backgroundColor: active ? tokens.surfaceRaised : tokens.surfaceSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  fontSize: 22,
                  lineHeight: 28,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {character}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel="One-time password"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  );
}
export const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Collapsible title={title}>{children}</Collapsible>
);
export const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button variant="ghost" onPress={() => setOpen(!open)}>
        {title}
      </Button>
      {open && children}
    </View>
  );
};
export const Command = ({ onSubmit }: { onSubmit?: (text: string) => void }) => (
  <Input
    accessibilityLabel="Search commands"
    placeholder="Search"
    onSubmitEditing={(e) => onSubmit?.(e.nativeEvent.text)}
  />
);

export function Toast({ message }: { message: string }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        padding: 14,
        borderRadius: 13,
        backgroundColor: tokens.foreground,
      }}
    >
      <Text style={{ color: tokens.background }}>{message}</Text>
    </View>
  );
}

export const Toggle = ({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (v: boolean) => void;
  children: React.ReactNode;
}) => (
  <Button variant={pressed ? 'primary' : 'outline'} onPress={() => onPressedChange(!pressed)}>
    {children}
  </Button>
);
export { View, getTouchTargetStyle };
export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <View accessibilityLabel={label}>{children}</View>
);
