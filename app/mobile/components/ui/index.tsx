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

export function Text({ children, style, ...props }: React.ComponentProps<typeof RNText>) {
  return (
    <RNText style={[{ color: '#172033' }, style]} {...props}>
      {children}
    </RNText>
  );
}
export const Typography = ({
  children,
  variant = 'body',
  ...props
}: React.ComponentProps<typeof RNText> & {
  variant?: 'title' | 'heading' | 'body' | 'caption';
}) => (
  <Text
    style={[
      variant === 'title' && { fontSize: 30, fontWeight: '700' },
      variant === 'heading' && { fontSize: 20, fontWeight: '700' },
      variant === 'caption' && { fontSize: 13, color: '#667085' },
    ]}
    {...props}
  >
    {children}
  </Text>
);
type ButtonProps = Omit<PressableProps, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  children: React.ReactNode;
};
export function Button({
  children,
  variant = 'primary',
  style,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const colors = {
    primary: ['#315CFF', '#FFFFFF'],
    secondary: ['#E8EDFF', '#2442B8'],
    ghost: ['transparent', '#172033'],
    destructive: ['#D92D20', '#FFFFFF'],
  } as const;
  const [backgroundColor, color] = colors[variant];
  const baseStyle = getTouchTargetStyle({
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[baseStyle, typeof style === 'function' ? undefined : style] as never}
      {...props}
    >
      <Text style={{ color, fontWeight: '700' }}>{children}</Text>
    </Pressable>
  );
}
export const Card = ({ children, style, ...props }: ViewProps) => (
  <View
    style={[
      {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D9E0EA',
      },
      style,
    ]}
    {...props}
  >
    {children}
  </View>
);
export const Input = (props: TextInputProps) => (
  <TextInput
    accessibilityRole="none"
    placeholderTextColor="#667085"
    style={[
      {
        minHeight: 48,
        borderWidth: 1,
        borderColor: '#D9E0EA',
        borderRadius: 10,
        paddingHorizontal: 14,
        color: '#172033',
        backgroundColor: '#FFFFFF',
      },
      props.style,
    ]}
    {...props}
  />
);
export const Label = ({ children, ...props }: React.ComponentProps<typeof RNText>) => (
  <Text {...props} style={[{ fontSize: 14, fontWeight: '600', marginBottom: 8 }, props.style]}>
    {children}
  </Text>
);
export const Badge = ({ children, ...props }: React.ComponentProps<typeof RNText>) => (
  <Text
    {...props}
    style={[
      {
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: '#E8EDFF',
        color: '#2442B8',
        fontSize: 12,
        fontWeight: '600',
      },
      props.style,
    ]}
  >
    {children}
  </Text>
);
export const Avatar = ({ initials, label }: { initials: string; label?: string }) => (
  <View
    accessibilityRole="image"
    accessibilityLabel={label ?? initials}
    style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#E8EDFF',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ color: '#2442B8', fontWeight: '700' }}>
      {initials.slice(0, 2).toUpperCase()}
    </Text>
  </View>
);
export const Separator = () => (
  <View accessibilityRole="none" style={{ height: 1, backgroundColor: '#D9E0EA', width: '100%' }} />
);
export const Progress = ({ value }: { value: number }) => (
  <View
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: 100, now: value }}
    style={{ height: 8, borderRadius: 4, backgroundColor: '#EEF2F7', overflow: 'hidden' }}
  >
    <View
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        height: '100%',
        backgroundColor: '#315CFF',
      }}
    />
  </View>
);
export const Checkbox = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
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
        borderRadius: 5,
        borderWidth: 2,
        borderColor: checked ? '#315CFF' : '#667085',
        backgroundColor: checked ? '#315CFF' : 'transparent',
      }}
    />{' '}
    <Text>{label}</Text>
  </Pressable>
);
export const RadioGroup = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (v: string) => void;
}) => (
  <View>
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
            borderColor: option.value === value ? '#315CFF' : '#667085',
          }}
        />{' '}
        <Text>{option.label}</Text>
      </Pressable>
    ))}
  </View>
);
export const Switch = ({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <Label>{label}</Label>
    <NativeSwitch accessibilityLabel={label} value={value} onValueChange={onValueChange} />{' '}
  </View>
);
export const Tabs = ({
  tabs,
  value,
  onChange,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {tabs.map((tab) => (
      <Button
        key={tab.value}
        variant={tab.value === value ? 'primary' : 'secondary'}
        onPress={() => onChange(tab.value)}
      >
        {tab.label}
      </Button>
    ))}
  </View>
);
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
          variant={option === value ? 'primary' : 'secondary'}
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
export const Sheet = ({
  visible,
  onClose,
  children,
  title = 'Actions',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close sheet"
      onPress={onClose}
      style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          gap: 10,
        }}
      >
        <Typography variant="heading">{title}</Typography>
        {children}
      </View>
    </Pressable>
  </Modal>
);
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
export const Skeleton = ({
  width = '100%',
  height = 18,
}: {
  width?: number | `${number}%`;
  height?: number;
}) => (
  <View
    accessibilityLabel="Loading"
    style={{ width, height, borderRadius: 8, backgroundColor: '#EEF2F7' }}
  />
);
export const Empty = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <View accessibilityLabel="Empty state" style={{ alignItems: 'center', gap: 8, padding: 24 }}>
    <Typography variant="heading">{title}</Typography>
    {description && <Text style={{ color: '#667085', textAlign: 'center' }}>{description}</Text>}
    {action}
  </View>
);
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
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      onPress={() => onValueChange(value >= 100 ? 0 : value + 10)}
      style={{ height: 8, backgroundColor: '#EEF2F7', borderRadius: 4 }}
    >
      <View
        style={{ width: `${value}%`, height: '100%', backgroundColor: '#315CFF', borderRadius: 4 }}
      />
    </Pressable>
  );
}
export const Textarea = (props: TextInputProps) => (
  <Input
    multiline
    textAlignVertical="top"
    {...props}
    style={[{ minHeight: 100, paddingTop: 12 }, props.style]}
  />
);
export const InputOTP = ({
  value,
  onChangeText,
  length = 6,
}: {
  value: string;
  onChangeText: (v: string) => void;
  length?: number;
}) => (
  <Input
    accessibilityLabel="One-time password"
    keyboardType="number-pad"
    maxLength={length}
    value={value}
    onChangeText={onChangeText}
  />
);
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
export const Toast = ({ message }: { message: string }) => (
  <View
    accessibilityLiveRegion="polite"
    style={{
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      padding: 14,
      borderRadius: 10,
      backgroundColor: '#172033',
    }}
  >
    <Text style={{ color: '#FFFFFF' }}>{message}</Text>
  </View>
);
export const Toggle = ({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (v: boolean) => void;
  children: React.ReactNode;
}) => (
  <Button variant={pressed ? 'primary' : 'secondary'} onPress={() => onPressedChange(!pressed)}>
    {children}
  </Button>
);
export { View, getTouchTargetStyle };
export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <View accessibilityLabel={label}>{children}</View>
);
