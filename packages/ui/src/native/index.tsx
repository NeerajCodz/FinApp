import React from 'react';
import { View } from 'react-native';
import { getTouchTargetStyle } from './touch-target';
import { useTheme } from './ThemeProvider';
import { Button } from './button';
import { Text } from './typography';
export { Text, Typography, Label, Badge, SectionHeader } from './typography';
export { Button, IconButton } from './button';
export { Card, Popover, Calendar } from './card';
export { Input, Textarea, Command, InputOTP } from './input';
export { Avatar, Separator, Progress, Skeleton, Empty } from './feedback';
export { Checkbox, RadioGroup, Switch, Tabs, Select, Slider } from './controls';
export { Sheet, Dialog, AlertDialog, Drawer, DropdownMenu } from './overlays';
export { ScrollArea, Accordion, Collapsible } from './navigation';
export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <View accessibilityLabel={label}>{children}</View>
);
export { View, getTouchTargetStyle };
export { ThemeProvider, useTheme } from './ThemeProvider';
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
