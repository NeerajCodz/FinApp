import { ArrowRight } from '@finapp/ui/icons/native';
import { currencies } from '@convex/shared/validators';
import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { type LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, IconButton, Sheet, Text, Typography } from '@finapp/ui/native';
import { resolveDefaultCurrency } from '@finapp/ui/finance';
import {
  Info,
  ArrowLeft,
  Bell,
  CaretRight,
  ChartLineUp,
  Coins,
  CurrencyDollar,
  Gear,
  NotePencil,
  Palette,
  ReceiptText,
  ShieldCheck,
  UsersThree,
  Wallet,
} from '@finapp/ui/icons/native';
import { useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import { clearValidatedLocalUserId } from '@/local/identity';

type ProfileRecord = LocalRecord & {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  phoneVerificationTime?: number;
  defaultCurrency?: string;
  avatarId?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarUrl?: string | null;
};

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
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const settingsState = useLocalRecords<LocalRecord>(userId, 'settings');
  const defaultCurrency =
    resolveDefaultCurrency(profileState.data ?? [], settingsState.data ?? []) ?? 'INR';
  const profile = profileState.data?.[0];
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyOptions = useMemo(() => [...currencies], []);

  const [saveError, setSaveError] = useState('');
  async function saveProfile(update: Partial<ProfileRecord>) {
    if (!userId) throw new Error('AUTH_REQUIRED');
    const currentProfile = profile ?? { id: userId, displayName: 'Your profile' };
    const nextProfile: ProfileRecord = { ...currentProfile, ...update };
    await commitLocalWrite(userId, 'profile', 'user.update', nextProfile, update, {
      recordId: String(currentProfile.id ?? currentProfile._id ?? userId),
    });
  }

  async function leave() {
    await clearValidatedLocalUserId();
    await signOut();
    router.replace('/(auth)/sign-in');
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconButton
              label="Go back"
              variant="ghost"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)
              }
            >
              <ArrowLeft size={21} color={tokens.foreground} />
            </IconButton>
            <Typography variant="title">Profile</Typography>
          </View>
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
              imageUrl={profile?.avatarUrl}
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
                {profile?.username ? `@${profile.username}` : 'Set username'}
              </Typography>
            </View>
          </View>
          <Button size="lg" variant="outline" onPress={() => router.push('/profile/edit' as never)}>
            <Text>Edit profile</Text>
          </Button>
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
              onPress={() => router.push('/accounts' as never)}
            />
            <ProfileTile
              icon={ReceiptText}
              label="Categories"
              description="Spending structure"
              onPress={() => router.push('/categories' as never)}
            />
            <ProfileTile
              icon={Coins}
              label="Budget"
              description="Limits and progress"
              onPress={() => router.push('/budgets' as never)}
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
            icon={CurrencyDollar}
            label="Default currency"
            value={defaultCurrency}
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

        <ProfileActionRow
          icon={Info}
          label="About"
          onPress={() => router.push('/about' as never)}
          last
        />

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

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Default currency">
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {currencyOptions.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={defaultCurrency === option ? 'primary' : 'outline'}
              onPress={async () => {
                setSaveError('');
                try {
                  await saveProfile({ defaultCurrency: option });
                  setCurrencyOpen(false);
                } catch (cause) {
                  setSaveError(cause instanceof Error ? cause.message : 'Could not save currency.');
                }
              }}
              style={{ width: '31%' }}
            >
              {option}
            </Button>
          ))}
        </ScrollView>
        {!!saveError && <Text accessibilityRole="alert">{saveError}</Text>}
      </Sheet>
    </>
  );
}
