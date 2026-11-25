'use client';

/**
 * The full-screen app lock (web): brand, the signed-in person (avatar in the accent ring, name,
 * @username), a status line and the unlock methods. Theme tokens only, so it follows light/dark
 * and custom accents.
 */
import * as React from 'react';
import { LockKeyhole } from 'lucide-react';
import { Avatar } from '../../web/fields';
import { FinanceBrand } from './FinanceBrand';
import styles from './LockScreen.module.css';

export type LockScreenPerson = {
  name: string;
  username?: string;
  initials: string;
  imageUrl?: string | null;
  avatarId?: string;
};

export function LockScreen({
  person,
  title = 'Finapp is locked',
  subtitle,
  children,
  note,
  onSignOut,
}: {
  person: LockScreenPerson;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Small print under the card (e.g. what the lock does and doesn't protect). */
  note?: React.ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <main className={styles.screen}>
      <div className={styles.glow} aria-hidden />
      <header className={styles.brand}>
        <FinanceBrand />
      </header>
      <section className={styles.center} aria-labelledby="lock-title">
        <div className={styles.person}>
          <span className={styles.ring}>
            <Avatar
              initials={person.initials}
              label={person.name}
              size={88}
              imageUrl={person.imageUrl}
              avatarId={person.avatarId}
            />
            <span className={styles.lockBadge} aria-hidden>
              <LockKeyhole size={14} strokeWidth={2.4} />
            </span>
          </span>
          <strong className={styles.name}>{person.name}</strong>
          {person.username ? <span className={styles.username}>@{person.username}</span> : null}
        </div>
        <div className={styles.card}>
          <h1 id="lock-title" className={styles.title}>
            {title}
          </h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          <div className={styles.actions}>{children}</div>
        </div>
        {note ? <p className={styles.note}>{note}</p> : null}
      </section>
      {onSignOut ? (
        <footer className={styles.footer}>
          Not {person.name.split(' ')[0]}?{' '}
          <button type="button" className={styles.link} onClick={onSignOut}>
            Sign out
          </button>
        </footer>
      ) : null}
    </main>
  );
}

/** Six-digit PIN entry shown as boxes; calls `onComplete` when all six digits are in. */
export function LockPinInput({
  value,
  onChange,
  onComplete,
  label,
  disabled,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (pin: string) => void;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus && !disabled) input.current?.focus();
  }, [autoFocus, disabled]);
  return (
    <label className={styles.pin} data-disabled={disabled || undefined} htmlFor={id}>
      <span className={styles.srOnly}>{label}</span>
      <input
        ref={input}
        id={id}
        className={styles.pinInput}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete?.(next);
        }}
      />
      <span className={styles.boxes} aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={styles.box}
            data-filled={index < value.length || undefined}
            data-active={index === Math.min(value.length, 5) || undefined}
          />
        ))}
      </span>
    </label>
  );
}
