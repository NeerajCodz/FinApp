'use client';
import React, { useId, useState } from 'react';

export { ThemeProvider, useTheme } from './ThemeProvider';
export {
  getTouchTargetStyle,
  Text,
  Typography,
  type Appearance,
  type TypographyVariant,
} from './typography';
export {
  Button,
  IconButton,
  type ButtonVariant,
  type ButtonSize,
  type ButtonProps,
} from './button';
export { Card } from './card';
export {
  Input,
  Label,
  Badge,
  Avatar,
  SectionHeader,
  Separator,
  Progress,
  type InputProps,
} from './fields';
export { PasswordField } from './PasswordField';
export { Checkbox, RadioGroup, Switch, Tabs, Select } from './choices';
export { Popover, Sheet, Dialog, AlertDialog, Drawer, type AlertDialogProps } from './overlay';
export { FilterOptionPopover, type FilterOptionPopoverOption } from './FilterOptionPopover';
export { Textarea, InputOTP, type TextareaProps } from './text-entry';
export { DropdownMenu, Calendar, Skeleton, Empty, ScrollArea, Slider } from './display';
export { Collapsible, Accordion, Command, Toast, Toggle, View } from './misc';
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
export { OnboardingAvatarPicker, ProfilePreview } from './OnboardingIdentity';
export type { ThemeTokens } from '../tokens';
export function Tooltip({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={['finapp-tooltip', className].filter(Boolean).join(' ')}
      aria-describedby={id}
      data-open={open || undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      <span id={id} role="tooltip" className="finapp-tooltip__content">
        {label}
      </span>
    </span>
  );
}
