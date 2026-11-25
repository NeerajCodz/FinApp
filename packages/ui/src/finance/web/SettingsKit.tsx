'use client';

import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import styles from './SettingsKit.module.css';

/** Settings page frame: back button, title, optional subtitle and header actions. */
export function SettingsShell({
  title,
  subtitle,
  onBack,
  actions,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  /** Two-column card grid on large screens (hubs). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page} data-wide={wide || undefined}>
      <header className={styles.header}>
        {onBack ? (
          <button type="button" className={styles.iconButton} aria-label="Go back" onClick={onBack}>
            <ArrowLeft size={19} aria-hidden />
          </button>
        ) : null}
        <div className={styles.titles}>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function SettingsIconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** A titled card holding rows. `span` makes it take the full width of a wide grid. */
export function SettingsGroup({
  title,
  description,
  span = false,
  children,
}: {
  title?: string;
  description?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.group} data-span={span || undefined}>
      {title || description ? (
        <header className={styles.groupHead}>
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

function RowIcon({ icon, tone }: { icon?: React.ReactNode; tone?: string }) {
  if (!icon) return null;
  return (
    <span className={styles.rowIcon} data-tone={tone} aria-hidden>
      {icon}
    </span>
  );
}

/** A row with custom trailing content (e.g. a button) and optional content below the text. */
export function SettingsItem({
  icon,
  tone,
  title,
  description,
  trailing,
  children,
}: {
  icon?: React.ReactNode;
  tone?: string;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.row} data-static>
      <RowIcon icon={icon} tone={tone} />
      <span className={styles.rowText}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
        {children ? <span className={styles.rowBody}>{children}</span> : null}
      </span>
      {trailing ? <span className={styles.rowTrailing}>{trailing}</span> : null}
    </div>
  );
}

/** A navigational row (chevron) or a plain action row. */
export function SettingsLink({
  icon,
  tone,
  title,
  description,
  value,
  badge,
  danger = false,
  onPress,
}: {
  icon?: React.ReactNode;
  /** Icon tint: 'primary' | 'positive' | 'warning' | 'danger' | 'info' | 'violet'. */
  tone?: string;
  title: string;
  description?: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.row}
      data-danger={danger || undefined}
      onClick={onPress}
      disabled={!onPress}
    >
      <RowIcon icon={icon} tone={danger ? 'danger' : tone} />
      <span className={styles.rowText}>
        <strong>
          {title}
          {badge ? <em className={styles.badge}>{badge}</em> : null}
        </strong>
        {description ? <small>{description}</small> : null}
      </span>
      {value ? <span className={styles.value}>{value}</span> : null}
      {onPress && !danger ? (
        <ChevronRight size={18} className={styles.chevron} aria-hidden />
      ) : null}
    </button>
  );
}

export function SettingsSwitch({
  icon,
  tone,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon?: React.ReactNode;
  tone?: string;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = React.useId();
  return (
    <label className={styles.row} htmlFor={id} data-disabled={disabled || undefined}>
      <RowIcon icon={icon} tone={tone} />
      <span className={styles.rowText}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <span className={styles.switch} data-on={checked || undefined}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span aria-hidden />
      </span>
    </label>
  );
}

/** A labelled segmented control (a few short choices). */
export function SettingsChoice<T extends string>({
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.rowText}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      <div className={styles.segments} role="radiogroup" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            data-active={option.value === value || undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsSelect<T extends string>({
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  const id = React.useId();
  return (
    <div className={styles.row} data-static>
      <label className={styles.rowText} htmlFor={id}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Multi-line text saved on blur (or with the Save button). */
export function SettingsTextArea({
  title,
  description,
  value,
  placeholder,
  maxLength,
  disabled,
  onSave,
}: {
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  onSave: (next: string) => Promise<unknown> | void;
}) {
  const id = React.useId();
  const [draft, setDraft] = React.useState(value);
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  React.useEffect(() => setDraft(value), [value]);
  const dirty = draft !== value;
  const save = async () => {
    if (!dirty) return;
    setState('saving');
    try {
      await onSave(draft);
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  };
  return (
    <div className={styles.block}>
      <label className={styles.rowText} htmlFor={id}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        rows={4}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => void save()}
      />
      <div className={styles.textFoot}>
        <small>
          {draft.length}/{maxLength}
        </small>
        <button
          type="button"
          className={styles.smallButton}
          disabled={!dirty || disabled}
          onClick={() => void save()}
        >
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/** A highlighted card at the top of a page (status, call to action). */
export function SettingsHero({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.hero} data-span>
      {icon ? <span className={styles.heroIcon}>{icon}</span> : null}
      <div className={styles.rowText}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      {action}
    </section>
  );
}

/** A labelled text input for use inside `SettingsItem`. */
export function SettingsField({
  label,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={styles.field}>
      {label}
      <input {...input} />
    </label>
  );
}
