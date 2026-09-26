'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { ThemeMode, ThemeTokens } from '../tokens';
export { ThemeProvider, useTheme } from './ThemeProvider';

export type Appearance = ThemeMode | 'system';

export function getTouchTargetStyle(style: React.CSSProperties = {}): React.CSSProperties {
  return { minWidth: 44, minHeight: 44, ...style };
}

type TextProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Text({
  as: Component = 'span',
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: TextProps) {
  return (
    <Component
      className={['finapp-text', className].filter(Boolean).join(' ')}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}

export type TypographyVariant =
  'hero' | 'display' | 'title' | 'heading' | 'bodyLarge' | 'body' | 'small' | 'caption' | 'label';

type TypographyProps = TextProps & { variant?: TypographyVariant };
const typographyTags: Record<TypographyVariant, React.ElementType> = {
  hero: 'h1',
  display: 'h1',
  title: 'h2',
  heading: 'h3',
  bodyLarge: 'p',
  body: 'p',
  small: 'small',
  caption: 'small',
  label: 'span',
};

export function Typography({
  variant = 'body',
  as,
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: TypographyProps) {
  const Component = as ?? typographyTags[variant];
  return (
    <Component
      className={['finapp-typography', `finapp-typography--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';
export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  type = 'button',
  className,
  onPress,
  onClick,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  ...props
}: ButtonProps) {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onPress?.(event);
    onClick?.(event);
  };
  return (
    <button
      {...props}
      type={type}
      onClick={handleClick}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      className={['finapp-button', `finapp-button--${variant}`, `finapp-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'children'> & { children: React.ReactNode; label: string }) {
  return (
    <Button
      aria-label={label}
      variant={variant}
      size="icon"
      {...props}
      className={['finapp-icon-button', props.className].filter(Boolean).join(' ')}
    >
      {children}
    </Button>
  );
}

export function Card({
  children,
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'subtle' | 'outline' }) {
  return (
    <div
      {...props}
      className={['finapp-card', `finapp-card--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  error?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onChangeText?: (value: string) => void;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Input({
  error = false,
  className,
  onChange,
  onChangeText,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange?.(event);
    onChangeText?.(event.currentTarget.value);
  };
  return (
    <input
      {...props}
      onChange={handleChange}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={['finapp-input', error && 'is-error', className].filter(Boolean).join(' ')}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={['finapp-label', className].filter(Boolean).join(' ')} {...props} />;
}

export function Badge({
  children,
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'danger' | 'neutral';
}) {
  return (
    <span
      {...props}
      className={['finapp-badge', `finapp-badge--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  label,
  size = 42,
  className,
}: {
  initials: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label ?? initials}
      className={['finapp-avatar', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={['finapp-section-header', className].filter(Boolean).join(' ')}>
      <Typography variant="heading">{title}</Typography>
      {action}
    </header>
  );
}

export function Separator(props: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr {...props} className={['finapp-separator', props.className].filter(Boolean).join(' ')} />
  );
}

export function Progress({
  value,
  color,
  height = 6,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: number; color?: string; height?: number }) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      {...props}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
      className={['finapp-progress', className].filter(Boolean).join(' ')}
      style={{ height, ...props.style }}
    >
      <span
        className="finapp-progress__fill"
        style={{ width: `${normalized}%`, backgroundColor: color ?? 'var(--finapp-foreground)' }}
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      className={['finapp-choice', disabled && 'is-disabled', className].filter(Boolean).join(' ')}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="finapp-choice__indicator" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset
      aria-label={label ? undefined : 'Options'}
      className={['finapp-radio-group', className].filter(Boolean).join(' ')}
      disabled={disabled}
    >
      {label && <legend className="finapp-label">{label}</legend>}
      {options.map((option, index) => (
        <label className="finapp-choice" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            tabIndex={value === undefined ? (index === 0 ? 0 : -1) : undefined}
          />
          <span className="finapp-choice__indicator" aria-hidden="true" />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Switch({
  value,
  onValueChange,
  label,
  disabled = false,
  className,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={['finapp-switch-row', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onValueChange(!value)}
        className="finapp-switch"
      >
        <span className="finapp-switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId().replace(/:/g, '');
  const selectByKeyboard: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tabs.length === 0)
      return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.value === value);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const selected = tabs[next];
    if (!selected) return;
    onChange(selected.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label ?? 'Sections'}
      onKeyDown={selectByKeyboard}
      className={['finapp-tabs', className].filter(Boolean).join(' ')}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          id={`${id}-tab-${index}`}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className="finapp-tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={['finapp-field', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="finapp-input finapp-select"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {!value && (
          <option value="" disabled>
            Select {label.toLowerCase()}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Popover({
  visible,
  children,
  className,
}: {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!visible) return null;
  return <div className={['finapp-popover', className].filter(Boolean).join(' ')}>{children}</div>;
}

type OverlayProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
};
type OverlayKind = 'sheet' | 'dialog' | 'alert' | 'drawer';

function Overlay({
  visible,
  onClose,
  children,
  title = 'Actions',
  className,
  kind,
}: OverlayProps & { kind: OverlayKind }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const panel = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      } else if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? focusable[focusable.length - 1] : focusable[0])?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [visible]);

  if (!visible) return null;
  const role = kind === 'alert' ? 'alertdialog' : 'dialog';
  return (
    <div
      className={`finapp-overlay finapp-overlay--${kind}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-state="open"
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={['finapp-overlay__panel', className].filter(Boolean).join(' ')}
      >
        <div className="finapp-overlay__heading">
          {kind === 'sheet' && <span className="finapp-sheet-handle" aria-hidden="true" />}
          <Typography as="h2" variant="heading" id={titleId}>
            {title}
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close"
            onPress={onClose}
            className="finapp-overlay__close"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>
        <div className="finapp-overlay__content">{children}</div>
      </div>
    </div>
  );
}

export function Sheet(props: OverlayProps) {
  return <Overlay {...props} kind="sheet" />;
}
export function Dialog(props: OverlayProps) {
  return <Overlay {...props} kind="dialog" />;
}
export function AlertDialog(props: OverlayProps) {
  return <Overlay {...props} kind="alert" />;
}
export function Drawer(props: OverlayProps) {
  return <Overlay {...props} kind="drawer" />;
}

export function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="group" className={['finapp-dropdown-menu', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Calendar({
  label = 'Calendar',
  value,
  onChange,
  min,
  max,
  className,
}: {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={['finapp-field', 'finapp-calendar', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        className="finapp-input"
        type="date"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 18,
  className,
}: {
  width?: number | `${number}%`;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={['finapp-skeleton', className].filter(Boolean).join(' ')}
      role="status"
      aria-label="Loading"
      style={{ width, height }}
    />
  );
}

export function Empty({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={['finapp-empty', className].filter(Boolean).join(' ')}
      aria-label="Empty state"
    >
      {icon && (
        <div className="finapp-empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <Typography variant="heading">{title}</Typography>
      {description && <p className="finapp-empty__description">{description}</p>}
      {action && <div className="finapp-empty__action">{action}</div>}
    </section>
  );
}

export function ScrollArea({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={['finapp-scroll-area', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label = 'Value',
  className,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <input
      className={['finapp-slider', className].filter(Boolean).join(' ')}
      aria-label={label}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onValueChange(Number(event.currentTarget.value))}
    />
  );
}

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onChangeText?: (value: string) => void;
  error?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Textarea({
  onChange,
  onChangeText,
  error = false,
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  'aria-invalid': ariaInvalid,
  ...props
}: TextareaProps) {
  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onChange?.(event);
    onChangeText?.(event.currentTarget.value);
  };
  return (
    <textarea
      {...props}
      onChange={handleChange}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={['finapp-input', 'finapp-textarea', error && 'is-error', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function InputOTP({
  value,
  onChangeText,
  length = 6,
  className,
  label = 'One-time password',
}: {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  className?: string;
  label?: string;
}) {
  const digits = value.replace(/\D/g, '').slice(0, length);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={['finapp-otp', className].filter(Boolean).join(' ')}>
      <div
        className="finapp-otp__cells"
        aria-hidden="true"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }, (_, index) => (
          <span className="finapp-otp__cell" key={index}>
            {digits[index] ?? ''}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        className="finapp-otp__input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label={label}
        value={digits}
        maxLength={length}
        onChange={(event) =>
          onChangeText(event.currentTarget.value.replace(/\D/g, '').slice(0, length))
        }
      />
    </div>
  );
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={['finapp-collapsible', className].filter(Boolean).join(' ')}
      open={defaultOpen || undefined}
    >
      <summary>{title}</summary>
      <div className="finapp-collapsible__content">{children}</div>
    </details>
  );
}

export function Accordion(props: React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible
      {...props}
      className={['finapp-accordion', props.className].filter(Boolean).join(' ')}
    />
  );
}

export function Command({
  onSubmit,
  placeholder = 'Search commands',
  className,
}: {
  onSubmit?: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  return (
    <form
      role="search"
      className={['finapp-command', className].filter(Boolean).join(' ')}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(query);
      }}
    >
      <Input
        aria-label="Search commands"
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

export function Toast({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={['finapp-toast', className].filter(Boolean).join(' ')}
    >
      {message}
    </div>
  );
}

export function Toggle({
  pressed,
  onPressedChange,
  children,
  className,
  disabled = false,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={pressed ? 'primary' : 'outline'}
      aria-pressed={pressed}
      disabled={disabled}
      onPress={() => onPressedChange(!pressed)}
      className={className}
    >
      {children}
    </Button>
  );
}

export function View({
  as: Component = 'div',
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
}) {
  return (
    <Component
      className={className}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}

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

export type { ThemeTokens };
