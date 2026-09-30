import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type ContextMenuItem = {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

export type ContextMenuProps = {
  children: React.ReactNode;
  items: ContextMenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  menuLabel?: string;
  delayLongPress?: number;
};

export function ContextMenu({
  children,
  items,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  style,
  accessibilityLabel = 'Show actions',
  menuLabel = 'Context menu',
  delayLongPress = 450,
}: ContextMenuProps) {
  const { tokens } = useTheme();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const select = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.onSelect();
    setOpen(false);
  };

  return (
    <View style={[{ position: 'relative', alignSelf: 'stretch' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Long press to show actions"
        accessibilityState={{ expanded: open }}
        delayLongPress={delayLongPress}
        onLongPress={() => setOpen(true)}
        onPress={() => {
          if (open) setOpen(false);
        }}
        style={({ pressed }) => ({ opacity: pressed && !open ? 0.92 : 1 })}
      >
        {children}
      </Pressable>
      {open ? (
        <View
          accessibilityRole="menu"
          accessibilityLabel={menuLabel}
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            padding: 5,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 14,
            backgroundColor: tokens.popover,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {items.map((item, index) => (
            <Pressable
              key={`${item.label}-${index}`}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: Boolean(item.disabled) }}
              disabled={item.disabled}
              onPress={() => select(item)}
              style={({ pressed }) => ({
                minHeight: 46,
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderRadius: 9,
                backgroundColor: pressed ? tokens.surfaceRaised : 'transparent',
                opacity: item.disabled ? 0.45 : 1,
              })}
            >
              <Text
                style={{
                  color: item.destructive ? tokens.destructive : tokens.foreground,
                  fontSize: 15,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
