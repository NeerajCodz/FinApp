import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { currencies } from '@convex/shared/validators';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, IconButton, Input, Label, Sheet, Text, Typography } from '@/components/ui';
import {
  ArrowRight,
  Bell,
  CaretRight,
  ChartLineUp,
  Check,
  Coins,
  ContactRound,
  CurrencyDollar,
  Gear,
  NotePencil,
  Palette,
  Phone,
  ReceiptText,
  ShieldCheck,
  UsersThree,
  Wallet,
} from '@/lib/icons';
import { useTheme } from '@/providers/ThemeProvider';
import { layoutTokens } from '@/lib/theme/tokens';

type Editor = 'username' | 'phone' | null;

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').toLowerCase();
}

type ActionIcon = React.ComponentType<{ size?: number; color?: string }>;

function ProfileTile({
  icon: Icon,
  label,
  description,
  onPress,
}: {
  icon: ActionIcon;
  label: string;
  description: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${description}`}
      activeOpacity={0.74}
      onPress={onPress}
      style={{
        width: '48.5%',
        minHeight: 126,
        padding: 16,
        borderRadius: 18,
        justifyContent: 'space-between',
        backgroundColor: tokens.surfaceSubtle,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.controlDisabledBackground,
        }}
      >
        <Icon size={19} color={tokens.primary} />
      </View>
      <View style={{ gap: 2 }}>
        <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
          {label}
        </Typography>
        <Typography variant="caption">{description}</Typography>
      </View>
    </TouchableOpacity>
  );
}

function ProfileActionRow({
  icon: Icon,
  label,
  value,
  onPress,
  last = false,
}: {
  icon: ActionIcon;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      activeOpacity={0.72}
      onPress={onPress}
      style={{
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.borderSubtle,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Icon size={19} color={tokens.foreground} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
          {label}
        </Typography>
        {value && <Typography variant="small">{value}</Typography>}
      </View>
      <CaretRight size={18} color={tokens.foregroundSubtle} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const profile = useQuery(api.users.queries.current);
  const updateProfile = useMutation(api.users.mutations.update);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyOptions = useMemo(() => [...currencies], []);
  const username = profile?.username ? `@${profile.username}` : 'Set username';
  const phone = profile?.phone ?? 'Add phone number';
  const editorDisabled = !draft.trim();

  function openEditor(next: Editor) {
    setEditor(next);
    setDraft(next === 'username' ? (profile?.username ?? '') : (profile?.phone ?? ''));
  }

  async function saveEditor() {
    if (editor === 'username') await updateProfile({ username: normalizeHandle(draft) });
    if (editor === 'phone') await updateProfile({ phone: draft });
    setEditor(null);
  }

  async function leave() {
    await signOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: layoutTokens.sectionGap,
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="title">Profile</Typography>
          <IconButton
            label="Open settings"
            variant="ghost"
            onPress={() => router.push('/settings' as never)}
          >
            <Gear size={21} color={tokens.foreground} />
          </IconButton>
        </View>

        <View
          style={{
            padding: 20,
            gap: 18,
            borderRadius: 24,
            backgroundColor: tokens.surfaceSubtle,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar
              initials={(profile?.displayName ?? 'NS').slice(0, 2)}
              label="Your profile"
              size={68}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Typography variant="heading">{profile?.displayName ?? 'Your profile'}</Typography>
              <Typography variant="small" numberOfLines={1}>
                {profile?.email ?? 'Private ledger'}
              </Typography>
            </View>
          </View>

          <View
            style={{
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: tokens.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tokens.controlDisabledBackground,
              }}
            >
              <UsersThree size={20} color={tokens.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Typography variant="caption">YOUR SHARE TAG</Typography>
              <Typography
                variant="bodyLarge"
                style={{ color: profile?.username ? tokens.primary : tokens.foreground }}
              >
                {username}
              </Typography>
            </View>
            <Button
              size="sm"
              variant="outline"
              onPress={() => openEditor('username')}
              style={{ width: 82 }}
            >
              <NotePencil size={15} color={tokens.foreground} />
              <Text
                style={{
                  marginLeft: 6,
                  color: tokens.foreground,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  fontSize: 13,
                }}
              >
                Edit
              </Text>
            </Button>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Typography variant="label">Money workspace</Typography>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 10,
            }}
          >
            <ProfileTile
              icon={Wallet}
              label="Accounts"
              description="Balances and activity"
              onPress={() => router.push('/account' as never)}
            />
            <ProfileTile
              icon={ReceiptText}
              label="Categories"
              description="Spending structure"
              onPress={() => router.push('/category' as never)}
            />
            <ProfileTile
              icon={Coins}
              label="Budget"
              description="Limits and progress"
              onPress={() => router.push('/budget' as never)}
            />
            <ProfileTile
              icon={ChartLineUp}
              label="Analytics"
              description="Patterns over time"
              onPress={() => router.push('/analytics' as never)}
            />
          </View>
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 4 }}>
            Profile details
          </Typography>
          <ProfileActionRow
            icon={ContactRound}
            label="Username"
            value={username}
            onPress={() => openEditor('username')}
          />
          <ProfileActionRow
            icon={Phone}
            label="Phone number"
            value={phone}
            onPress={() => openEditor('phone')}
          />
          <ProfileActionRow
            icon={CurrencyDollar}
            label="Default currency"
            value={profile?.defaultCurrency ?? 'INR'}
            onPress={() => setCurrencyOpen(true)}
            last
          />
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 4 }}>
            Preferences
          </Typography>
          <ProfileActionRow
            icon={Palette}
            label="Appearance"
            value="Dark"
            onPress={() => router.push('/settings/appearance' as never)}
          />
          <ProfileActionRow
            icon={Bell}
            label="Notifications"
            onPress={() => router.push('/settings/notifications' as never)}
          />
          <ProfileActionRow
            icon={ShieldCheck}
            label="Security"
            onPress={() => router.push('/settings/security' as never)}
            last
          />
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 4 }}>
            Data and privacy
          </Typography>
          <ProfileActionRow
            icon={NotePencil}
            label="Export data"
            onPress={() => router.push('/settings/privacy' as never)}
          />
          <ProfileActionRow
            icon={ShieldCheck}
            label="Privacy"
            onPress={() => router.push('/settings/privacy' as never)}
            last
          />
        </View>

        <Button variant="destructive" size="lg" onPress={leave}>
          <Text
            style={{
              color: tokens.destructive,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Sign out
          </Text>
          <ArrowRight size={18} color={tokens.destructive} style={{ marginLeft: 8 }} />
        </Button>
      </ScrollView>

      <Sheet
        visible={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === 'username' ? 'Edit username' : 'Add phone number'}
      >
        <View style={{ gap: 12 }}>
          <Label>{editor === 'username' ? 'Username' : 'Phone number'}</Label>
          <Input
            autoFocus
            accessibilityLabel={editor === 'username' ? 'Username' : 'Phone number'}
            keyboardType={editor === 'username' ? 'default' : 'phone-pad'}
            autoCapitalize={editor === 'username' ? 'none' : 'words'}
            textContentType={editor === 'username' ? 'username' : 'telephoneNumber'}
            placeholder={editor === 'username' ? '@neeraj' : '+91 98765 43210'}
            value={draft}
            onChangeText={setDraft}
          />
          <Typography variant="caption">
            {editor === 'username'
              ? '3–32 letters, numbers, or underscores.'
              : 'Use an international format so friends can find you.'}
          </Typography>
          <Button size="lg" onPress={saveEditor} disabled={editorDisabled}>
            <Check
              size={18}
              color={
                editorDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground
              }
            />
            <Text
              style={{
                marginLeft: 8,
                color: editorDisabled
                  ? tokens.controlDisabledForeground
                  : tokens.primaryForeground,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontSize: 15,
              }}
            >
              Save changes
            </Text>
          </Button>
        </View>
      </Sheet>

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Default currency">
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {currencyOptions.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={profile?.defaultCurrency === option ? 'primary' : 'outline'}
              onPress={async () => {
                await updateProfile({ defaultCurrency: option });
                setCurrencyOpen(false);
              }}
              style={{ width: '31%' }}
            >
              {option}
            </Button>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}
