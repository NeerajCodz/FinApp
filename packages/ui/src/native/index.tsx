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
export {
  Sheet,
  Dialog,
  AlertDialog,
  Drawer,
  DropdownMenu,
  type AlertDialogProps,
} from './overlays';
export { FilterSheet, type FilterSheetOption } from './FilterSheet';
export { QuickFiltersPopover } from './QuickFiltersPopover';
export { ScrollArea, Accordion, Collapsible } from './navigation';
export { Alert, type AlertVariant } from './Alert';
export { AspectRatio, type AspectRatioProps } from './AspectRatio';
export { Attachment, type AttachmentProps, type AttachmentState } from './Attachment';
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from './Breadcrumb';
export { ButtonGroup, type ButtonGroupOrientation, type ButtonGroupProps } from './ButtonGroup';
export { Bubble, type BubbleAlignment, type BubbleProps } from './Bubble';
export { Carousel, type CarouselProps } from './Carousel';
export { Combobox, type ComboboxOption, type ComboboxProps } from './Combobox';
export { ContextMenu, type ContextMenuItem, type ContextMenuProps } from './ContextMenu';
export { MessageScroller, type MessageScrollerProps } from './MessageScroller';
export { NativeSelect, type NativeSelectOption, type NativeSelectProps } from './NativeSelect';
export { Chart, type ChartDataPoint, type ChartProps } from './Chart';
export { DataTable, type DataTableColumn, type DataTableProps } from './DataTable';
export { Direction, type DirectionProps } from './Direction';
export { HoverCard, type HoverCardProps } from './HoverCard';
export { InputGroup, type InputGroupProps } from './InputGroup';
export { Item, type ItemProps } from './Item';
export { Kbd, type KbdProps } from './Kbd';
export { Marker, type MarkerProps, type MarkerVariant } from './Marker';
export { Menubar, type MenubarItem, type MenubarProps } from './Menubar';
export { Message, type MessageProps, type MessageStatus, type MessageType } from './Message';
export {
  NavigationMenu,
  type NavigationMenuItem,
  type NavigationMenuProps,
} from './NavigationMenu';
export { Pagination, type PaginationProps } from './Pagination';
export {
  QuestionnaireNew,
  type QuestionnaireAnswers,
  type QuestionnaireField,
  type QuestionnaireNewProps,
} from './QuestionnaireNew';
export { Resizable, type ResizableOrientation, type ResizableProps } from './Resizable';
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  type SidebarItemProps,
  type SidebarProps,
  type SidebarSlotProps,
} from './Sidebar';
export { Spinner, type SpinnerProps } from './Spinner';
export { Table, type TableColumn, type TableProps } from './Table';
export {
  ToggleGroup,
  type MultipleToggleGroupProps,
  type SingleToggleGroupProps,
  type ToggleGroupOption,
  type ToggleGroupProps,
} from './ToggleGroup';
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
