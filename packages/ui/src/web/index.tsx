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
export { Checkbox, RadioGroup, Switch, Tabs, Select } from './choices';
export { Popover, Sheet, Dialog, AlertDialog, Drawer } from './overlay';
export { FilterOptionPopover, type FilterOptionPopoverOption } from './FilterOptionPopover';
export { Textarea, InputOTP, type TextareaProps } from './text-entry';
export { DropdownMenu, Calendar, Skeleton, Empty, ScrollArea, Slider } from './display';
export { Collapsible, Accordion, Command, Toast, Toggle, View } from './misc';
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
