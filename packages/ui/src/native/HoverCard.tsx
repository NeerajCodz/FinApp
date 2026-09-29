import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type HoverCardProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  triggerLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A press-triggered details card, rendered inline without a portal. */
export function HoverCard({
  children,
  content,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  label = 'Additional information',
  triggerLabel = 'Show additional information',
  style,
}: HoverCardProps) {
  const { tokens } = useTheme();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    if (nextOpen !== open) onOpenChange?.(nextOpen);
  };

  return (
    <View style={[{ alignSelf: 'stretch' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
        accessibilityHint="Double tap to show or hide additional information"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        {children}
      </Pressable>
      {open ? (
        <View
          accessibilityRole="summary"
          accessibilityLabel={label}
          style={{
            position: 'relative',
            marginTop: 8,
            padding: 16,
            paddingEnd: 44,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 14,
            backgroundColor: tokens.popover,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close additional information"
            onPress={() => setOpen(false)}
            hitSlop={8}
            style={{ position: 'absolute', top: 6, end: 8, zIndex: 1, padding: 6 }}
          >
            <Text style={{ color: tokens.foregroundMuted, fontSize: 18, lineHeight: 22 }}>×</Text>
          </Pressable>
          {content}
        </View>
      ) : null}
    </View>
  );
}
