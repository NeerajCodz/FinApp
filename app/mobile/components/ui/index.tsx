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

export function Text({ children, style, ...props }: React.ComponentProps<typeof RNText>) {
  const { tokens } = useTheme();
  return (
    <RNText
      style={[{ color: tokens.foreground, fontFamily: 'PlusJakartaSans_400Regular' }, style]}
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
  variant?: 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';
}) => {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        variant === 'display' && {
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 38,
          lineHeight: 42,
          letterSpacing: -1.2,
        },
        variant === 'title' && {
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 30,
          lineHeight: 34,
          letterSpacing: -0.7,
        },
        variant === 'heading' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 19,
          lineHeight: 24,
          letterSpacing: -0.25,
        },
        variant === 'caption' && {
          fontSize: 12,
          lineHeight: 17,
          color: tokens.mutedForeground,
        },
        variant === 'label' && {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: tokens.mutedForeground,
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
    ghost: { backgroundColor: 'transparent', color: tokens.foreground },
    destructive: { backgroundColor: tokens.destructive, color: tokens.destructiveForeground },
  } as const;
  const { backgroundColor, color } = colors[variant];
  const compact = size === 'sm';
  const icon = size === 'icon';
  const baseStyle = getTouchTargetStyle({
    minWidth: icon ? 44 : undefined,
    borderRadius: icon ? 14 : 13,
    paddingHorizontal: icon ? 0 : compact ? 12 : 17,
    paddingVertical: icon ? 0 : compact ? 8 : size === 'lg' ? 15 : 12,
    minHeight: icon ? 44 : size === 'lg' ? 56 : 44,
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
      disabled={disabled}
      style={({ pressed }) => [
        baseStyle,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.88 },
        disabled && { opacity: 0.4 },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text
          style={{
            color,
            fontFamily: 'PlusJakartaSans_600SemiBold',
            fontSize: compact ? 12 : 14,
            letterSpacing: 0.1,
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
  return (
    <View
      style={[
        {
          backgroundColor: variant === 'subtle' ? tokens.surfaceSubtle : tokens.card,
          borderRadius: 20,
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

export function Input({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityRole="none"
      placeholderTextColor={tokens.mutedForeground}
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
          minHeight: 52,
          borderWidth: 1,
          borderColor: focused ? tokens.ring : tokens.borderSubtle,
          borderRadius: 13,
          paddingHorizontal: 15,
          color: tokens.foreground,
          backgroundColor: tokens.input,
          fontFamily: 'PlusJakartaSans_400Regular',
          fontSize: 14,
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
    success: { backgroundColor: `${tokens.income}22`, color: tokens.income },
    danger: { backgroundColor: `${tokens.expense}22`, color: tokens.expense },
    neutral: { backgroundColor: tokens.muted, color: tokens.mutedForeground },
  } as const;
  return (
    <Text
      {...props}
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: palette[variant].backgroundColor,
          color: palette[variant].color,
          fontSize: 11,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          letterSpacing: 0.2,
        },
        props.style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Avatar({ initials, label, size = 42 }: { initials: string; label?: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label ?? initials}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: tokens.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: tokens.primaryForeground, fontFamily: 'SpaceGrotesk_700Bold', fontSize: size * 0.34 }}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Typography variant="heading">{title}</Typography>
      {action}
    </View>
  );
}

export function Separator() {
  const { tokens } = useTheme();
  return <View accessibilityRole="none" style={{ height: 1, backgroundColor: tokens.borderSubtle, width: '100%' }} />;
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={{ height: 9, borderRadius: 5, backgroundColor: tokens.muted, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          backgroundColor: color ?? tokens.primary,
          borderRadius: 5,
        }}
      />
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={getTouchTargetStyle({ flexDirection: 'row', alignItems: 'center', gap: 10 })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: checked ? tokens.primary : tokens.border,
          backgroundColor: checked ? tokens.primary : tokens.background,
        }}
      />
      <Text>{label}</Text>
    </Pressable>
  );
}

export function RadioGroup({ options, value, onChange }: { options: { label: string; value: string }[]; value?: string; onChange: (v: string) => void }) {
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
            {option.value === value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.primary }} />}
          </View>
          <Text>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Switch = ({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) => {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
      <Label style={{ marginBottom: 0, color: tokens.foreground, textTransform: 'none', letterSpacing: 0 }}>{label}</Label>
      <NativeSwitch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ false: tokens.muted, true: tokens.primary }} thumbColor={tokens.foreground} />
    </View>
  );
};

export const Tabs = ({ tabs, value, onChange }: { tabs: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {tabs.map((tab) => (
      <Button key={tab.value} size="sm" variant={tab.value === value ? 'primary' : 'outline'} onPress={() => onChange(tab.value)}>
        {tab.label}
      </Button>
    ))}
  </View>
);

export const Select = ({ label, options, value, onChange }: { label: string; options: string[]; value?: string; onChange: (v: string) => void }) => (
  <View>
    <Label>{label}</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => (
        <Button key={option} size="sm" variant={option === value ? 'primary' : 'outline'} onPress={() => onChange(option)}>
          {option}
        </Button>
      ))}
    </View>
  </View>
);

export const Popover = ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <Card>{children}</Card> : null);

export function Sheet({ visible, onClose, children, title = 'Actions' }: { visible: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  const { tokens } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: tokens.overlay }}>
        <View onStartShouldSetResponder={() => true} style={{ backgroundColor: tokens.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 12, borderTopWidth: 1, borderColor: tokens.borderSubtle }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: tokens.mutedForeground, alignSelf: 'center', marginBottom: 4 }} />
          <Typography variant="heading">{title}</Typography>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

export const Dialog = Sheet;
export const AlertDialog = Sheet;
export const Drawer = Sheet;
export const DropdownMenu = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
export const Calendar = ({ label = 'Calendar' }: { label?: string }) => <Card><Text accessibilityRole="header">{label}</Text></Card>;

export function Skeleton({ width = '100%', height = 18 }: { width?: number | `${number}%`; height?: number }) {
  const { tokens } = useTheme();
  return <View accessibilityLabel="Loading" style={{ width, height, borderRadius: 9, backgroundColor: tokens.muted }} />;
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View accessibilityLabel="Empty state" style={{ alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 18 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tokens.muted, marginBottom: 2 }} />
      <Typography variant="heading" style={{ textAlign: 'center' }}>{title}</Typography>
      {description && <Text style={{ color: tokens.mutedForeground, textAlign: 'center', lineHeight: 20 }}>{description}</Text>}
      {action}
    </View>
  );
}

export const ScrollArea = ({ children, ...props }: React.ComponentProps<typeof ScrollView>) => <ScrollView {...props}>{children}</ScrollView>;

export function Slider({ value, onValueChange }: { value: number; onValueChange: (value: number) => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 100, now: value }} onPress={() => onValueChange(value >= 100 ? 0 : value + 10)} style={{ height: 9, backgroundColor: tokens.muted, borderRadius: 5 }}>
      <View style={{ width: `${value}%`, height: '100%', backgroundColor: tokens.primary, borderRadius: 5 }} />
    </Pressable>
  );
}

export const Textarea = (props: TextInputProps) => <Input multiline textAlignVertical="top" {...props} style={[{ minHeight: 100, paddingTop: 14 }, props.style]} />;
export const InputOTP = ({ value, onChangeText, length = 6 }: { value: string; onChangeText: (v: string) => void; length?: number }) => <Input accessibilityLabel="One-time password" keyboardType="number-pad" maxLength={length} value={value} onChangeText={onChangeText} />;
export const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => <Collapsible title={title}>{children}</Collapsible>;
export const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return <View><Button variant="ghost" onPress={() => setOpen(!open)}>{title}</Button>{open && children}</View>;
};
export const Command = ({ onSubmit }: { onSubmit?: (text: string) => void }) => <Input accessibilityLabel="Search commands" placeholder="Search" onSubmitEditing={(e) => onSubmit?.(e.nativeEvent.text)} />;

export function Toast({ message }: { message: string }) {
  const { tokens } = useTheme();
  return <View accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: 24, left: 16, right: 16, padding: 14, borderRadius: 13, backgroundColor: tokens.foreground }}><Text style={{ color: tokens.background }}>{message}</Text></View>;
}

export const Toggle = ({ pressed, onPressedChange, children }: { pressed: boolean; onPressedChange: (v: boolean) => void; children: React.ReactNode }) => <Button variant={pressed ? 'primary' : 'outline'} onPress={() => onPressedChange(!pressed)}>{children}</Button>;
export { View, getTouchTargetStyle };
export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => <View accessibilityLabel={label}>{children}</View>;
