import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type NavigationMenuItem = {
  value: string;
  label: React.ReactNode;
  href?: string;
  disabled?: boolean;
  children?: readonly NavigationMenuItem[];
};

export type NavigationMenuProps = {
  items: readonly NavigationMenuItem[];
  activeValue?: string;
  defaultActiveValue?: string;
  onActiveChange?: (value: string, item: NavigationMenuItem) => void;
  onNavigate?: (item: NavigationMenuItem, index: number) => void;
  label?: string;
  style?: ViewStyle;
};

export function NavigationMenu({
  items,
  activeValue,
  defaultActiveValue,
  onActiveChange,
  onNavigate,
  label = 'Main navigation',
  style,
}: NavigationMenuProps) {
  const { tokens } = useTheme();
  const [uncontrolledActive, setUncontrolledActive] = useState(defaultActiveValue);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const active = activeValue ?? uncontrolledActive;

  const activate = (item: NavigationMenuItem, index: number) => {
    if (item.disabled) return;
    if (activeValue === undefined) setUncontrolledActive(item.value);
    onActiveChange?.(item.value, item);
    onNavigate?.(item, index);
  };

  const renderItems = (entries: readonly NavigationMenuItem[], depth = 0): React.ReactNode => (
    <View style={depth > 0 ? styles.children : undefined}>
      {entries.map((item, index) => {
        const selected = active === item.value;
        const hasChildren = !!item.children?.length;
        const isExpanded = expanded.has(item.value);
        return (
          <View key={item.value}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={typeof item.label === 'string' ? item.label : undefined}
                accessibilityState={{ disabled: !!item.disabled, selected }}
                disabled={item.disabled}
                onPress={() => activate(item, index)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: selected ? tokens.border : 'transparent',
                    backgroundColor: selected ? tokens.surfaceRaised : 'transparent',
                    opacity: item.disabled ? 0.55 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                {typeof item.label === 'string' || typeof item.label === 'number' ? (
                  <Text
                    style={{
                      color: selected ? tokens.foreground : tokens.foregroundMuted,
                      fontWeight: selected ? '600' : '500',
                    }}
                  >
                    {item.label}
                  </Text>
                ) : (
                  item.label
                )}
              </Pressable>
              {hasChildren && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} submenu`}
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(item.value)) next.delete(item.value);
                      else next.add(item.value);
                      return next;
                    })
                  }
                  style={({ pressed }) => [
                    styles.expand,
                    { backgroundColor: pressed ? tokens.surfaceRaised : 'transparent' },
                  ]}
                >
                  <Text style={{ color: tokens.foregroundMuted }}>{isExpanded ? '−' : '+'}</Text>
                </Pressable>
              )}
            </View>
            {hasChildren && isExpanded && renderItems(item.children!, depth + 1)}
          </View>
        );
      })}
    </View>
  );

  return (
    <View accessibilityRole="menu" accessibilityLabel={label} style={style}>
      {renderItems(items)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  item: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  expand: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  children: { paddingLeft: 16, paddingVertical: 4 },
});
