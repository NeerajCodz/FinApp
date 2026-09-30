import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

export type BreadcrumbProps = {
  items: readonly BreadcrumbItem[];
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
  label?: string;
  style?: ViewStyle;
};

export function Breadcrumb({ items, onNavigate, label = 'Breadcrumb', style }: BreadcrumbProps) {
  const { tokens } = useTheme();
  const currentIndex = items.findIndex((item) => item.current);
  return (
    <View accessibilityLabel={label} style={[styles.container, style]}>
      <View style={styles.crumbs}>
        {items.map((item, index) => {
          const current = item.current ?? (currentIndex < 0 && index === items.length - 1);
          const navigable = !current && !!onNavigate;
          return (
            <React.Fragment key={`${index}-${item.href ?? ''}`}>
              {index > 0 && (
                <Text
                  accessible={false}
                  style={[styles.separator, { color: tokens.foregroundSubtle }]}
                >
                  /
                </Text>
              )}
              <Pressable
                accessibilityRole={navigable ? 'link' : 'text'}
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: !navigable, selected: current }}
                disabled={!navigable}
                onPress={navigable ? () => onNavigate?.(item, index) : undefined}
                style={({ pressed }) => [styles.item, { opacity: pressed ? 0.72 : 1 }]}
              >
                <Text
                  style={{
                    color: current ? tokens.foreground : tokens.foregroundMuted,
                    fontWeight: current ? '600' : '400',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  crumbs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  item: { minHeight: 32, justifyContent: 'center' },
  separator: { fontSize: 13 },
});
