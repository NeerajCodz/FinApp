import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';

export type SidebarProps = {
  children?: React.ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export type SidebarSlotProps = { children?: React.ReactNode; style?: StyleProp<ViewStyle> };

export type SidebarItemProps = {
  children: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type SidebarContextValue = { collapsed: boolean };
const SidebarContext = React.createContext<SidebarContextValue>({ collapsed: false });

export function Sidebar({
  children,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  label = 'Sidebar navigation',
  style,
}: SidebarProps) {
  const { tokens } = useTheme();
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = React.useState(defaultCollapsed);
  const isCollapsed = collapsed ?? uncontrolledCollapsed;
  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setUncontrolledCollapsed(next);
    onCollapsedChange?.(next);
  };
  return (
    <SidebarContext.Provider value={{ collapsed: isCollapsed }}>
      <View
        accessibilityRole="none"
        style={[
          {
            width: isCollapsed ? 68 : 256,
            alignSelf: 'stretch',
            flexShrink: 0,
            backgroundColor: tokens.surfaceSubtle,
            borderRightWidth: 1,
            borderRightColor: tokens.border,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          accessibilityState={{ expanded: !isCollapsed }}
          onPress={toggleCollapsed}
          style={{
            minHeight: 48,
            alignItems: isCollapsed ? 'center' : 'flex-end',
            justifyContent: 'center',
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: tokens.foregroundMuted, fontSize: 20 }}>
            {isCollapsed ? '›' : '‹'}
          </Text>
        </Pressable>
        <ScrollView
          accessibilityLabel={label}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View accessibilityRole="none" style={{ flex: 1 }}>
            {children}
          </View>
        </ScrollView>
      </View>
    </SidebarContext.Provider>
  );
}

export function SidebarHeader({ children, style }: SidebarSlotProps) {
  const { tokens } = useTheme();
  return (
    <View style={[{ paddingHorizontal: 16, paddingVertical: 12 }, style]}>
      <Text style={{ color: tokens.foregroundStrong, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function SidebarContent({ children, style }: SidebarSlotProps) {
  return <View style={[{ padding: 8, gap: 4 }, style]}>{children}</View>;
}

export function SidebarFooter({ children, style }: SidebarSlotProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        { marginTop: 'auto', padding: 12, borderTopWidth: 1, borderTopColor: tokens.borderSubtle },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SidebarItem({
  children,
  href,
  icon,
  active = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: SidebarItemProps) {
  const { tokens } = useTheme();
  const { collapsed } = React.useContext(SidebarContext);
  const label = accessibilityLabel ?? (typeof children === 'string' ? children : undefined);
  const activate = () => {
    onPress?.();
    if (href) void Linking.openURL(href);
  };
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={href ? `Navigate to ${label ?? 'destination'}` : undefined}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={activate}
      style={({ pressed }) => [
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12,
          paddingHorizontal: collapsed ? 8 : 12,
          paddingVertical: 8,
          borderRadius: 9,
          backgroundColor: active ? tokens.surfaceRaised : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon}
        </View>
      ) : null}
      {!collapsed ? (
        <Text
          style={{
            color: active ? tokens.primary : tokens.foregroundMuted,
            fontWeight: active ? '600' : '400',
            flexShrink: 1,
          }}
        >
          {children}
        </Text>
      ) : null}
    </Pressable>
  );
}
