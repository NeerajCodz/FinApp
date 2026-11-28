'use client';

import React from 'react';
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Coins,
  Globe2,
  Loader2,
  Mail,
  Phone,
  Trash2,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import { Avatar } from '@finapp/ui/web';
import styles from './ProfileEditScreen.module.css';
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  avatarPhotoProblem,
  searchTimezones,
  timezoneLabel,
  timezoneOffset,
  type AvatarGender,
  type ProfileChanges,
  type ProfileDraft,
  type UsernameStatus,
} from '../profileForm';
import { useProfileEditor } from '../useProfileEditor';

export type ProfileSaveResult = {
  message: string;
  tone?: 'success' | 'warning';
  savedDraft?: Partial<ProfileDraft>;
};

export type ProfileEditScreenProps = {
  /** Saved profile as a draft; `undefined` while it loads. */
  initial: ProfileDraft | undefined;
  loadError?: string | null;
  email?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  defaultCurrency?: string;
  avatars: readonly { avatarId: string; gender: AvatarGender }[] | undefined;
  offline?: boolean;
  usernameStatus: UsernameStatus;
  /** Called with the typed username so the page can check availability. */
  onUsernameChange: (username: string) => void;
  timezones: readonly string[];
  onSave: (draft: ProfileDraft, changes: ProfileChanges) => Promise<ProfileSaveResult>;
  onBack: () => void;
  onOpenCurrency: () => void;
};

const genders: { value: AvatarGender; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('') || 'F'
  );
}

function Field({
  id,
  label,
  icon,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field} data-invalid={error ? true : undefined}>
      <div className={styles.fieldHead}>
        <label htmlFor={id}>
          {icon}
          {label}
        </label>
        {counter ? <span className={styles.counter}>{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function UsernameState({ status }: { status: UsernameStatus }) {
  if (status === 'checking')
    return (
      <span className={styles.state}>
        <Loader2 size={14} className={styles.spin} aria-hidden /> Checking…
      </span>
    );
  if (status === 'available')
    return (
      <span className={styles.state} data-tone="positive">
        <Check size={14} aria-hidden /> Available
      </span>
    );
  if (status === 'taken')
    return (
      <span className={styles.state} data-tone="danger">
        <X size={14} aria-hidden /> Taken
      </span>
    );
  return null;
}

function TimezonePicker({
  id,
  value,
  zones,
  invalid,
  onChange,
}: {
  id: string;
  value: string;
  zones: readonly string[];
  invalid?: boolean;
  onChange: (zone: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const matches = React.useMemo(() => searchTimezones(zones, query, 50), [zones, query]);
  const label = value ? timezoneLabel(value) : null;
  const choose = (zone: string) => {
    onChange(zone);
    setQuery('');
    setOpen(false);
  };
  return (
    <div className={styles.combo}>
      <div className={styles.inputWrap} data-invalid={invalid || undefined}>
        <Globe2 size={16} aria-hidden className={styles.inputIcon} />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          placeholder={
            label ? `${label.city}${label.region ? ` · ${label.region}` : ''}` : 'Search a city'
          }
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open && matches[active]) {
              event.preventDefault();
              choose(matches[active]);
            } else if (event.key === 'Escape') setOpen(false);
          }}
        />
        {value ? <span className={styles.offset}>{timezoneOffset(value)}</span> : null}
      </div>
      {open ? (
        <ul id={`${id}-list`} role="listbox" className={styles.listbox}>
          {matches.length === 0 ? (
            <li className={styles.noMatch}>No time zone matches “{query}”.</li>
          ) : (
            matches.map((zone, index) => {
              const parts = timezoneLabel(zone);
              return (
                <li
                  key={zone}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={zone === value}
                  data-active={index === active || undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(zone);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <span>
                    <strong>{parts.city}</strong>
                    {parts.region ? <small>{parts.region}</small> : null}
                  </span>
                  <span className={styles.offset}>{timezoneOffset(zone)}</span>
                  {zone === value ? <Check size={15} aria-hidden /> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function ProfileEditScreen({
  initial,
  loadError,
  email,
  emailVerified,
  phoneVerified,
  defaultCurrency,
  avatars,
  offline,
  usernameStatus,
  onUsernameChange,
  timezones,
  onSave,
  onBack,
  onOpenCurrency,
}: ProfileEditScreenProps) {
  const editor = useProfileEditor(initial, usernameStatus);
  const { draft, visibleErrors: errors, dirty } = editor;
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<ProfileSaveResult | null>(null);
  const [saveError, setSaveError] = React.useState('');
  const [photoError, setPhotoError] = React.useState('');
  const [gender, setGender] = React.useState<AvatarGender>('neutral');
  const fileInput = React.useRef<HTMLInputElement | null>(null);
  const previewUrl = draft?.avatar.kind === 'newPhoto' ? draft.avatar.previewUrl : null;

  React.useEffect(() => {
    if (draft?.avatar.kind === 'preset') setGender(draft.avatar.gender);
    // Only follow the saved avatar when the editor first loads.
  }, [editor.baseline]);
  React.useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const leave = () => {
    if (dirty && !window.confirm('Discard your unsaved profile changes?')) return;
    onBack();
  };

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!draft || !editor.changes || saving) return;
    editor.attemptSave();
    if (!editor.valid) return;
    setSaving(true);
    setSaveError('');
    try {
      const result = await onSave(draft, editor.changes);
      if (result.tone === 'warning') editor.commitPartial(draft, result.savedDraft ?? {});
      else editor.commit(draft);
      setToast(result);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const problem = avatarPhotoProblem({ type: file.type, size: file.size });
    setPhotoError(problem ?? '');
    if (problem) return;
    editor.update('avatar', { kind: 'newPhoto', previewUrl: URL.createObjectURL(file), file });
  };

  if (loadError)
    return (
      <div className={styles.page}>
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      </div>
    );

  const avatar = draft?.avatar;
  const name = draft?.displayName ?? '';
  const choices = (avatars ?? []).filter((item) => item.gender === gender);
  const hasPhoto = avatar?.kind === 'photo' || avatar?.kind === 'newPhoto';

  return (
    <form className={styles.page} onSubmit={(event) => void save(event)} noValidate>
      <header className={styles.header}>
        <button type="button" className={styles.iconButton} aria-label="Go back" onClick={leave}>
          <ArrowLeft size={19} aria-hidden />
        </button>
        <div className={styles.titles}>
          <h1>Edit profile</h1>
          <p>How you appear to friends and groups on Finapp.</p>
        </div>
      </header>

      {offline ? (
        <p className={styles.banner} role="status">
          <WifiOff size={15} aria-hidden /> Offline — name, bio, phone, time zone and preset avatars
          save on this device and sync later. Username and photo changes need a connection.
        </p>
      ) : null}

      {!draft ? (
        <div className={styles.skeleton} role="status" aria-label="Loading your profile">
          <span className={styles.skeletonAvatar} />
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonLine} style={{ width: '60%' }} />
        </div>
      ) : (
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="profile-photo-title">
            <div className={styles.hero}>
              <div className={styles.preview}>
                <Avatar
                  initials={initialsOf(name)}
                  label="Profile picture preview"
                  size={112}
                  avatarId={avatar?.kind === 'preset' ? avatar.avatarId : undefined}
                  imageUrl={
                    avatar?.kind === 'photo'
                      ? avatar.url
                      : avatar?.kind === 'newPhoto'
                        ? avatar.previewUrl
                        : null
                  }
                />
                <button
                  type="button"
                  className={styles.cameraButton}
                  aria-label="Upload a photo"
                  disabled={offline}
                  onClick={() => fileInput.current?.click()}
                >
                  <Camera size={16} aria-hidden />
                </button>
              </div>
              <div className={styles.heroText}>
                <h2 id="profile-photo-title">{name.trim() || 'Your name'}</h2>
                <p>@{draft.username.trim().replace(/^@+/, '').toLowerCase() || 'username'}</p>
                {draft.bio.trim() ? <p className={styles.heroBio}>{draft.bio.trim()}</p> : null}
              </div>
            </div>
            <div className={styles.photoActions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={offline}
                onClick={() => fileInput.current?.click()}
              >
                <Camera size={15} aria-hidden /> Upload photo
              </button>
              {hasPhoto ? (
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => {
                    setPhotoError('');
                    const first = choices[0] ?? avatars?.[0];
                    editor.update(
                      'avatar',
                      first
                        ? { kind: 'preset', avatarId: first.avatarId, gender: first.gender }
                        : { kind: 'none' },
                    );
                  }}
                >
                  <Trash2 size={15} aria-hidden /> Remove photo
                </button>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(event) => {
                  pickPhoto(event.currentTarget.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </div>
            {photoError ? (
              <p className={styles.error} role="alert">
                {photoError}
              </p>
            ) : (
              <p className={styles.hint}>JPEG, PNG, WebP or GIF up to 5 MB, or pick an avatar.</p>
            )}

            <div className={styles.segments} role="radiogroup" aria-label="Avatar style">
              {genders.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={gender === option.value}
                  data-active={gender === option.value || undefined}
                  onClick={() => setGender(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {!avatars ? (
              <p className={styles.hint} role="status">
                Loading avatars…
              </p>
            ) : (
              <div className={styles.avatarGrid} role="radiogroup" aria-label="Avatars">
                {choices.map((item) => {
                  const selected = avatar?.kind === 'preset' && avatar.avatarId === item.avatarId;
                  return (
                    <button
                      key={item.avatarId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Avatar ${item.avatarId}`}
                      data-selected={selected || undefined}
                      className={styles.avatarChoice}
                      onClick={() =>
                        editor.update('avatar', {
                          kind: 'preset',
                          avatarId: item.avatarId,
                          gender: item.gender,
                        })
                      }
                    >
                      <Avatar initials="" label="" avatarId={item.avatarId} size={52} />
                      {selected ? (
                        <span className={styles.avatarCheck} aria-hidden>
                          <Check size={12} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.column}>
            <section className={styles.card} aria-labelledby="profile-about-title">
              <h2 id="profile-about-title" className={styles.cardTitle}>
                About you
              </h2>
              <Field
                id="profile-name"
                label="Display name"
                icon={<UserRound size={14} aria-hidden />}
                error={errors.displayName}
                counter={`${draft.displayName.trim().length}/${DISPLAY_NAME_MAX_LENGTH}`}
              >
                <div className={styles.inputWrap} data-invalid={errors.displayName || undefined}>
                  <input
                    id="profile-name"
                    autoComplete="name"
                    maxLength={DISPLAY_NAME_MAX_LENGTH + 10}
                    value={draft.displayName}
                    aria-invalid={Boolean(errors.displayName)}
                    aria-describedby={errors.displayName ? 'profile-name-error' : undefined}
                    onChange={(event) => editor.update('displayName', event.currentTarget.value)}
                    onBlur={() => editor.touch('displayName')}
                  />
                </div>
              </Field>
              <Field
                id="profile-username"
                label="Username"
                icon={<AtSign size={14} aria-hidden />}
                error={errors.username}
                hint={
                  offline
                    ? 'Reconnect to change your username.'
                    : '3–32 letters, numbers or underscores. Friends can find you with it.'
                }
              >
                <div className={styles.inputWrap} data-invalid={errors.username || undefined}>
                  <span className={styles.prefix} aria-hidden>
                    @
                  </span>
                  <input
                    id="profile-username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={40}
                    value={draft.username}
                    disabled={offline}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={
                      errors.username ? 'profile-username-error' : 'profile-username-hint'
                    }
                    onChange={(event) => {
                      editor.update('username', event.currentTarget.value);
                      editor.touch('username');
                      onUsernameChange(event.currentTarget.value);
                    }}
                  />
                  <UsernameState status={usernameStatus} />
                </div>
              </Field>
              <Field
                id="profile-bio"
                label="Bio"
                error={errors.bio}
                counter={`${draft.bio.trim().length}/${BIO_MAX_LENGTH}`}
                hint="A line about you, shown on your public profile."
              >
                <textarea
                  id="profile-bio"
                  className={styles.textarea}
                  rows={3}
                  maxLength={BIO_MAX_LENGTH + 20}
                  value={draft.bio}
                  placeholder="Splitting rent, chasing goals…"
                  aria-invalid={Boolean(errors.bio)}
                  onChange={(event) => editor.update('bio', event.currentTarget.value)}
                  onBlur={() => editor.touch('bio')}
                />
              </Field>
            </section>

            <section className={styles.card} aria-labelledby="profile-contact-title">
              <h2 id="profile-contact-title" className={styles.cardTitle}>
                Contact
              </h2>
              <Field
                id="profile-email"
                label="Email"
                icon={<Mail size={14} aria-hidden />}
                hint="Your sign-in email can’t be changed here."
              >
                <div className={styles.inputWrap} data-readonly>
                  <input id="profile-email" value={email ?? ''} readOnly aria-readonly />
                  {emailVerified ? (
                    <span className={styles.badge}>
                      <BadgeCheck size={13} aria-hidden /> Verified
                    </span>
                  ) : null}
                </div>
              </Field>
              <Field
                id="profile-phone"
                label="Phone"
                icon={<Phone size={14} aria-hidden />}
                error={errors.phone}
                hint={
                  draft.phone.trim() && phoneVerified
                    ? 'Verified. Changing it removes the verification.'
                    : 'Optional. International format, e.g. +44 7700 900123.'
                }
              >
                <div className={styles.inputWrap} data-invalid={errors.phone || undefined}>
                  <input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={24}
                    value={draft.phone}
                    placeholder="+44 7700 900123"
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(event) => editor.update('phone', event.currentTarget.value)}
                    onBlur={() => editor.touch('phone')}
                  />
                  {phoneVerified && draft.phone.trim() && !editor.changes?.identity.phone ? (
                    <span className={styles.badge}>
                      <BadgeCheck size={13} aria-hidden /> Verified
                    </span>
                  ) : null}
                </div>
              </Field>
            </section>

            <section className={styles.card} aria-labelledby="profile-region-title">
              <h2 id="profile-region-title" className={styles.cardTitle}>
                Region
              </h2>
              <Field
                id="profile-timezone"
                label="Time zone"
                icon={<Clock3 size={14} aria-hidden />}
                error={errors.timezone}
                hint="Used for daily summaries, reminders and recurring payments."
              >
                <TimezonePicker
                  id="profile-timezone"
                  value={draft.timezone}
                  zones={timezones}
                  invalid={Boolean(errors.timezone)}
                  onChange={(zone) => editor.update('timezone', zone)}
                />
              </Field>
              <button type="button" className={styles.linkRow} onClick={onOpenCurrency}>
                <span className={styles.linkIcon} aria-hidden>
                  <Coins size={17} />
                </span>
                <span className={styles.linkText}>
                  <strong>Default currency</strong>
                  <small>New accounts and totals use it.</small>
                </span>
                <span className={styles.linkValue}>{defaultCurrency ?? '—'}</span>
                <ChevronRight size={17} aria-hidden />
              </button>
            </section>
          </div>
        </div>
      )}

      {draft && (dirty || saving || saveError) ? (
        <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
          <span className={styles.saveText}>
            {saveError ? (
              <span className={styles.saveError} role="alert">
                {saveError}
              </span>
            ) : (
              'You have unsaved changes'
            )}
          </span>
          <button
            type="button"
            className={styles.ghost}
            disabled={saving}
            onClick={() => {
              setSaveError('');
              setPhotoError('');
              editor.discard();
            }}
          >
            Discard
          </button>
          <button type="submit" className={styles.primary} disabled={saving || !dirty}>
            {saving ? <Loader2 size={15} className={styles.spin} aria-hidden /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className={styles.toast} data-tone={toast.tone ?? 'success'} role="status">
          <Check size={16} aria-hidden /> {toast.message}
        </div>
      ) : null}
    </form>
  );
}
