import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import {
  AtSign,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Coins,
  Mail,
  Phone,
  Search,
  Trash2,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Avatar, Text, useTheme } from '@finapp/ui/native';
import { withAlpha } from '../../tokens';
import { SettingsIconButton } from './SettingsKit';
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  searchTimezones,
  timezoneLabel,
  timezoneOffset,
  type AvatarGender,
  type ProfileChanges,
  type ProfileDraft,
  type UsernameStatus,
} from '../profileForm';
import { useProfileEditor } from '../useProfileEditor';

export type ProfileSaveResult = { message: string; tone?: 'success' | 'warning' };

export type ProfileEditScreenProps = {
  initial: ProfileDraft | undefined;
  loadError?: string | null;
  onRetry?: () => void;
  email?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  defaultCurrency?: string;
  avatars: readonly { avatarId: string; gender: AvatarGender }[] | undefined;
  offline?: boolean;
  usernameStatus: UsernameStatus;
  onUsernameChange: (username: string) => void;
  timezones: readonly string[];
  /** Opens the photo library; resolves to the picked image (platform data in `file`). */
  onPickPhoto: () => Promise<{ previewUrl: string; file: unknown } | null>;
  onSave: (draft: ProfileDraft, changes: ProfileChanges) => Promise<ProfileSaveResult>;
  /** Called after a successful save (e.g. to go back). */
  onSaved?: () => void;
  onBack: () => void;
  onOpenCurrency: () => void;
  topInset?: number;
  bottomInset?: number;
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

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        gap: 16,
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.card,
      }}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={{
            color: tokens.foregroundMuted,
            fontSize: 11.5,
            fontFamily: 'Manrope_700Bold',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Field({
  label,
  icon,
  error,
  hint,
  counter,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text
          style={{
            flex: 1,
            color: tokens.foreground,
            fontSize: 13.5,
            fontFamily: 'Manrope_700Bold',
          }}
        >
          {label}
        </Text>
        {counter ? (
          <Text
            style={{ color: error ? tokens.destructive : tokens.foregroundMuted, fontSize: 12 }}
          >
            {counter}
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive, fontSize: 12.5 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: tokens.foregroundMuted, fontSize: 12.5, lineHeight: 17 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function InputBox({
  invalid,
  readOnly,
  prefix,
  trailing,
  ...input
}: TextInputProps & {
  invalid?: boolean;
  readOnly?: boolean;
  prefix?: string;
  trailing?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: readOnly ? 'dashed' : 'solid',
        borderColor: invalid ? tokens.destructive : focused ? tokens.primary : tokens.borderSubtle,
        backgroundColor: readOnly ? 'transparent' : tokens.surfaceSubtle,
      }}
    >
      {prefix ? (
        <Text style={{ color: tokens.foregroundMuted, fontFamily: 'Manrope_700Bold' }}>
          {prefix}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={tokens.foregroundSubtle}
        selectionColor={tokens.primary}
        editable={!readOnly && input.editable !== false}
        {...input}
        onFocus={(event) => {
          setFocused(true);
          input.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          input.onBlur?.(event);
        }}
        style={[
          {
            flex: 1,
            minWidth: 0,
            paddingVertical: input.multiline ? 12 : 0,
            minHeight: input.multiline ? 84 : 46,
            color:
              input.editable === false || readOnly ? tokens.foregroundMuted : tokens.foreground,
            fontSize: 15,
            fontFamily: 'Manrope_500Medium',
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
          input.style,
        ]}
      />
      {trailing}
    </View>
  );
}

function Badge({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: withAlpha(tokens.positive, 0.16),
      }}
    >
      <BadgeCheck size={12} color={tokens.positive} />
      <Text style={{ color: tokens.positive, fontSize: 11, fontFamily: 'Manrope_700Bold' }}>
        {label}
      </Text>
    </View>
  );
}

function Button({
  label,
  icon,
  variant = 'ghost',
  disabled,
  busy,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const background =
    variant === 'primary'
      ? tokens.primary
      : variant === 'secondary'
        ? withAlpha(tokens.primary, 0.12)
        : 'transparent';
  const color =
    variant === 'primary'
      ? tokens.primaryForeground
      : variant === 'secondary'
        ? tokens.primary
        : tokens.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor:
          variant === 'primary'
            ? tokens.primary
            : variant === 'secondary'
              ? withAlpha(tokens.primary, 0.4)
              : tokens.borderSubtle,
        backgroundColor: background,
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon}
      <Text style={{ color, fontSize: 14, fontFamily: 'Manrope_700Bold' }}>{label}</Text>
    </Pressable>
  );
}

function TimezoneSheet({
  visible,
  value,
  zones,
  onClose,
  onChoose,
}: {
  visible: boolean;
  value: string;
  zones: readonly string[];
  onClose: () => void;
  onChoose: (zone: string) => void;
}) {
  const { tokens } = useTheme();
  const [query, setQuery] = React.useState('');
  const matches = React.useMemo(() => searchTimezones(zones, query, 120), [zones, query]);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: tokens.background, paddingTop: 16 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              color: tokens.foreground,
              fontSize: 22,
              fontFamily: 'SpaceGrotesk_600SemiBold',
            }}
          >
            Time zone
          </Text>
          <SettingsIconButton label="Close" onPress={onClose}>
            <X size={19} color={tokens.foreground} />
          </SettingsIconButton>
        </View>
        <View style={{ padding: 16 }}>
          <InputBox
            autoFocus
            accessibilityLabel="Search time zones"
            placeholder="Search a city or region"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            trailing={<Search size={16} color={tokens.foregroundMuted} />}
          />
        </View>
        <FlatList
          data={matches}
          keyExtractor={(zone) => zone}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <Text style={{ color: tokens.foregroundMuted, padding: 12 }}>
              No time zone matches “{query}”.
            </Text>
          }
          renderItem={({ item: zone }) => {
            const parts = timezoneLabel(zone);
            const selected = zone === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChoose(zone);
                  setQuery('');
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: selected ? tokens.primary : tokens.foreground,
                      fontSize: 15,
                      fontFamily: 'Manrope_600SemiBold',
                    }}
                  >
                    {parts.city}
                  </Text>
                  {parts.region ? (
                    <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                      {parts.region}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 12.5 }}>
                  {timezoneOffset(zone)}
                </Text>
                {selected ? <Check size={16} color={tokens.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function ProfileEditScreen({
  initial,
  loadError,
  onRetry,
  email,
  emailVerified,
  phoneVerified,
  defaultCurrency,
  avatars,
  offline,
  usernameStatus,
  onUsernameChange,
  timezones,
  onPickPhoto,
  onSave,
  onSaved,
  onBack,
  onOpenCurrency,
  topInset = 0,
  bottomInset = 0,
}: ProfileEditScreenProps) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const editor = useProfileEditor(initial, usernameStatus);
  const { draft, visibleErrors: errors, dirty } = editor;
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [notice, setNotice] = React.useState<ProfileSaveResult | null>(null);
  const [photoError, setPhotoError] = React.useState('');
  const [gender, setGender] = React.useState<AvatarGender>('neutral');
  const [zonesOpen, setZonesOpen] = React.useState(false);
  const twoColumn = width >= 900;

  React.useEffect(() => {
    if (draft?.avatar.kind === 'preset') setGender(draft.avatar.gender);
    // Follow the saved avatar only when the editor first loads.
  }, [editor.baseline]);

  const leave = () => {
    if (!dirty) return onBack();
    Alert.alert('Discard changes?', 'Your unsaved profile changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  };

  const save = async () => {
    if (!draft || !editor.changes || saving) return;
    editor.attemptSave();
    if (!editor.valid) {
      setSaveError('Check the highlighted fields.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const result = await onSave(draft, editor.changes);
      editor.commit(draft);
      if (result.tone === 'warning') setNotice(result);
      else {
        setNotice(result);
        onSaved?.();
      }
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const pick = async () => {
    setPhotoError('');
    try {
      const picked = await onPickPhoto();
      if (picked) editor.update('avatar', { kind: 'newPhoto', ...picked });
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Could not open your photos.');
    }
  };

  const avatar = draft?.avatar;
  const name = draft?.displayName ?? '';
  const choices = (avatars ?? []).filter((item) => item.gender === gender);
  const hasPhoto = avatar?.kind === 'photo' || avatar?.kind === 'newPhoto';
  const tile = Math.max(52, Math.min(64, Math.floor((Math.min(width, 720) - 32 - 36 - 5 * 8) / 6)));

  const photoCard = draft ? (
    <Card>
      <View
        style={{
          alignItems: 'center',
          gap: 12,
          padding: 18,
          borderRadius: 18,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        <View>
          <View
            style={{
              padding: 3,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: tokens.primary,
            }}
          >
            <Avatar
              initials={initialsOf(name)}
              label="Profile picture preview"
              size={104}
              avatarId={avatar?.kind === 'preset' ? avatar.avatarId : undefined}
              imageUrl={
                avatar?.kind === 'photo'
                  ? avatar.url
                  : avatar?.kind === 'newPhoto'
                    ? avatar.previewUrl
                    : null
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a photo"
            disabled={offline}
            onPress={() => void pick()}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 3,
              borderColor: tokens.card,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.primary,
              opacity: offline ? 0.6 : 1,
            }}
          >
            <Camera size={16} color={tokens.primaryForeground} />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 2, maxWidth: '100%' }}>
          <Text
            numberOfLines={1}
            style={{
              color: tokens.foreground,
              fontSize: 20,
              fontFamily: 'SpaceGrotesk_600SemiBold',
            }}
          >
            {name.trim() || 'Your name'}
          </Text>
          <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 14 }}>
            @{draft.username.trim().replace(/^@+/, '').toLowerCase() || 'username'}
          </Text>
          {draft.bio.trim() ? (
            <Text
              numberOfLines={2}
              style={{ marginTop: 4, color: tokens.foreground, fontSize: 13, textAlign: 'center' }}
            >
              {draft.bio.trim()}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          variant="secondary"
          label="Choose photo"
          icon={<Camera size={15} color={tokens.primary} />}
          disabled={offline}
          onPress={() => void pick()}
        />
        {hasPhoto ? (
          <Button
            label="Remove photo"
            icon={<Trash2 size={15} color={tokens.foreground} />}
            onPress={() => {
              const first = choices[0] ?? avatars?.[0];
              editor.update(
                'avatar',
                first
                  ? { kind: 'preset', avatarId: first.avatarId, gender: first.gender }
                  : { kind: 'none' },
              );
            }}
          />
        ) : null}
      </View>
      <Text
        accessibilityRole={photoError ? 'alert' : undefined}
        style={{ color: photoError ? tokens.destructive : tokens.foregroundMuted, fontSize: 12.5 }}
      >
        {photoError ||
          (offline
            ? 'Reconnect to upload a photo, or pick an avatar.'
            : 'Upload a photo or pick an avatar.')}
      </Text>
      <View
        accessibilityRole="radiogroup"
        style={{
          flexDirection: 'row',
          gap: 6,
          padding: 4,
          borderRadius: 14,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        {genders.map((option) => {
          const active = option.value === gender;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setGender(option.value)}
              style={{
                flex: 1,
                minHeight: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                borderWidth: active ? 1 : 0,
                borderColor: tokens.borderSubtle,
                backgroundColor: active ? tokens.card : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 13,
                  fontFamily: 'Manrope_600SemiBold',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!avatars ? (
        <ActivityIndicator color={tokens.primary} />
      ) : (
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {choices.map((item) => {
            const selected = avatar?.kind === 'preset' && avatar.avatarId === item.avatarId;
            return (
              <Pressable
                key={item.avatarId}
                accessibilityRole="radio"
                accessibilityLabel={`Avatar ${item.avatarId}`}
                accessibilityState={{ checked: selected }}
                onPress={() =>
                  editor.update('avatar', {
                    kind: 'preset',
                    avatarId: item.avatarId,
                    gender: item.gender,
                  })
                }
                style={{
                  padding: 2,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: selected ? tokens.primary : 'transparent',
                }}
              >
                <Avatar initials="" label="" avatarId={item.avatarId} size={tile - 8} />
                {selected ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: tokens.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: tokens.primary,
                    }}
                  >
                    <Check size={11} color={tokens.primaryForeground} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  ) : null;

  const usernameTrailing =
    usernameStatus === 'checking' ? (
      <ActivityIndicator size="small" color={tokens.foregroundMuted} />
    ) : usernameStatus === 'available' ? (
      <Check size={16} color={tokens.positive} accessibilityLabel="Available" />
    ) : usernameStatus === 'taken' ? (
      <X size={16} color={tokens.destructive} accessibilityLabel="Taken" />
    ) : undefined;
  const zone = draft ? timezoneLabel(draft.timezone || 'UTC') : null;

  const formCards = draft ? (
    <View style={{ gap: 16 }}>
      <Card title="About you">
        <Field
          label="Display name"
          icon={<UserRound size={14} color={tokens.foregroundMuted} />}
          error={errors.displayName}
          counter={`${draft.displayName.trim().length}/${DISPLAY_NAME_MAX_LENGTH}`}
        >
          <InputBox
            accessibilityLabel="Display name"
            autoComplete="name"
            textContentType="name"
            value={draft.displayName}
            invalid={Boolean(errors.displayName)}
            onChangeText={(value) => editor.update('displayName', value)}
            onBlur={() => editor.touch('displayName')}
            placeholder="Your name"
          />
        </Field>
        <Field
          label="Username"
          icon={<AtSign size={14} color={tokens.foregroundMuted} />}
          error={errors.username}
          hint={
            offline
              ? 'Reconnect to change your username.'
              : '3–32 letters, numbers or underscores. Friends can find you with it.'
          }
        >
          <InputBox
            accessibilityLabel="Username"
            prefix="@"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            value={draft.username}
            editable={!offline}
            invalid={Boolean(errors.username)}
            trailing={usernameTrailing}
            onChangeText={(value) => {
              editor.update('username', value);
              editor.touch('username');
              onUsernameChange(value);
            }}
            placeholder="username"
          />
        </Field>
        <Field
          label="Bio"
          error={errors.bio}
          counter={`${draft.bio.trim().length}/${BIO_MAX_LENGTH}`}
          hint="A line about you, shown on your public profile."
        >
          <InputBox
            accessibilityLabel="Bio"
            multiline
            value={draft.bio}
            invalid={Boolean(errors.bio)}
            onChangeText={(value) => editor.update('bio', value)}
            onBlur={() => editor.touch('bio')}
            placeholder="Splitting rent, chasing goals…"
          />
        </Field>
      </Card>
      <Card title="Contact">
        <Field
          label="Email"
          icon={<Mail size={14} color={tokens.foregroundMuted} />}
          hint="Your sign-in email can’t be changed here."
        >
          <InputBox
            accessibilityLabel="Email"
            readOnly
            value={email ?? ''}
            trailing={emailVerified ? <Badge label="Verified" /> : undefined}
          />
        </Field>
        <Field
          label="Phone"
          icon={<Phone size={14} color={tokens.foregroundMuted} />}
          error={errors.phone}
          hint={
            draft.phone.trim() && phoneVerified
              ? 'Verified. Changing it removes the verification.'
              : 'Optional. International format, e.g. +44 7700 900123.'
          }
        >
          <InputBox
            accessibilityLabel="Phone number"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            value={draft.phone}
            invalid={Boolean(errors.phone)}
            onChangeText={(value) => editor.update('phone', value)}
            onBlur={() => editor.touch('phone')}
            placeholder="+44 7700 900123"
            trailing={
              phoneVerified && draft.phone.trim() && !editor.changes?.identity.phone ? (
                <Badge label="Verified" />
              ) : undefined
            }
          />
        </Field>
      </Card>
      <Card title="Region">
        <Field
          label="Time zone"
          icon={<Clock3 size={14} color={tokens.foregroundMuted} />}
          error={errors.timezone}
          hint="Used for daily summaries, reminders and recurring payments."
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Time zone, ${zone?.city ?? 'not set'}. Change`}
            onPress={() => setZonesOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minHeight: 48,
              paddingHorizontal: 12,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: errors.timezone ? tokens.destructive : tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: tokens.foreground, fontSize: 15 }}>
                {zone?.city}
                {zone?.region ? (
                  <Text style={{ color: tokens.foregroundMuted }}> · {zone.region}</Text>
                ) : null}
              </Text>
            </View>
            <Text style={{ color: tokens.foregroundMuted, fontSize: 12.5 }}>
              {timezoneOffset(draft.timezone || 'UTC')}
            </Text>
            <ChevronRight size={16} color={tokens.foregroundSubtle} />
          </Pressable>
        </Field>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCurrency}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
          })}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: withAlpha(tokens.primary, 0.16),
            }}
          >
            <Coins size={17} color={tokens.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: tokens.foreground,
                fontSize: 14.5,
                fontFamily: 'Manrope_600SemiBold',
              }}
            >
              Default currency
            </Text>
            <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
              New accounts and totals use it.
            </Text>
          </View>
          <Text style={{ color: tokens.foregroundMuted, fontFamily: 'Manrope_700Bold' }}>
            {defaultCurrency ?? '—'}
          </Text>
          <ChevronRight size={16} color={tokens.foregroundSubtle} />
        </Pressable>
      </Card>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: topInset + 10,
          paddingBottom: bottomInset + (dirty || saveError ? 120 : 32),
          gap: 16,
          width: '100%',
          maxWidth: twoColumn ? 1080 : 720,
          alignSelf: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SettingsIconButton label="Go back" onPress={leave}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </SettingsIconButton>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={{
                color: tokens.foreground,
                fontSize: 28,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                letterSpacing: -0.8,
              }}
            >
              Edit profile
            </Text>
            <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
              How you appear to friends and groups.
            </Text>
          </View>
        </View>

        {offline ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <WifiOff size={15} color={tokens.foregroundMuted} />
            <Text
              style={{ flex: 1, color: tokens.foregroundMuted, fontSize: 12.5, lineHeight: 17 }}
            >
              Offline — name, bio, phone, time zone and avatars save on this device and sync later.
              Username and photo changes need a connection.
            </Text>
          </View>
        ) : null}
        {notice ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              gap: 8,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: withAlpha(
                notice.tone === 'warning' ? tokens.warning : tokens.positive,
                0.45,
              ),
              backgroundColor: withAlpha(
                notice.tone === 'warning' ? tokens.warning : tokens.positive,
                0.1,
              ),
            }}
          >
            <Check size={15} color={notice.tone === 'warning' ? tokens.warning : tokens.positive} />
            <Text style={{ flex: 1, color: tokens.foreground, fontSize: 13 }}>
              {notice.message}
            </Text>
          </View>
        ) : null}

        {loadError ? (
          <Card>
            <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {loadError}
            </Text>
            {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
          </Card>
        ) : !draft ? (
          <Card>
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              />
              <View
                style={{
                  width: '40%',
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              />
              <View
                style={{
                  width: '60%',
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              />
            </View>
          </Card>
        ) : twoColumn ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ width: 380 }}>{photoCard}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{formCards}</View>
          </View>
        ) : (
          <>
            {photoCard}
            {formCards}
          </>
        )}
      </ScrollView>

      {draft && (dirty || saving || saveError) ? (
        <View
          accessibilityLabel="Unsaved changes"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: bottomInset + 14,
            maxWidth: 688,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            paddingLeft: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: withAlpha(tokens.primary, 0.35),
            backgroundColor: tokens.popover,
          }}
        >
          <Text
            accessibilityRole={saveError ? 'alert' : undefined}
            numberOfLines={2}
            style={{
              flex: 1,
              color: saveError ? tokens.destructive : tokens.popoverForeground,
              fontSize: 13,
              fontFamily: 'Manrope_600SemiBold',
            }}
          >
            {saveError || 'Unsaved changes'}
          </Text>
          <Button
            label="Discard"
            disabled={saving}
            onPress={() => {
              setSaveError('');
              editor.discard();
            }}
          />
          <Button
            variant="primary"
            label={saving ? 'Saving…' : 'Save'}
            busy={saving}
            disabled={saving || !dirty}
            onPress={() => void save()}
          />
        </View>
      ) : null}

      {draft ? (
        <TimezoneSheet
          visible={zonesOpen}
          value={draft.timezone}
          zones={timezones}
          onClose={() => setZonesOpen(false)}
          onChoose={(next) => {
            editor.update('timezone', next);
            setZonesOpen(false);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
