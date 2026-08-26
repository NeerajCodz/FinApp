import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsRow } from '@/components/finance';
import { Avatar, Button, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function leave() {
    await signOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 124,
        gap: 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Typography variant="title">Profile</Typography>

      <View style={{ gap: 14 }}>
        <Avatar initials="NS" label="Your profile" size={58} />
        <View style={{ gap: 3 }}>
          <Typography variant="heading">Your profile</Typography>
          <Typography variant="small">Personal ledger</Typography>
        </View>
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Money
        </Typography>
        <SettingsRow label="Accounts" onPress={() => router.push('/account' as never)} />
        <Separator />
        <SettingsRow label="Categories" onPress={() => router.push('/category' as never)} />
        <Separator />
        <SettingsRow label="Budget" onPress={() => router.push('/budget' as never)} />
        <Separator />
        <SettingsRow label="Analytics" onPress={() => router.push('/analytics' as never)} />
        <Separator />
        <SettingsRow
          label="Default currency"
          value="INR"
          onPress={() => router.push('/settings/currency' as never)}
        />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Preferences
        </Typography>
        <SettingsRow
          label="Appearance"
          value="Dark"
          onPress={() => router.push('/settings/appearance' as never)}
        />
        <Separator />
        <SettingsRow
          label="Notifications"
          onPress={() => router.push('/settings/notifications' as never)}
        />
        <Separator />
        <SettingsRow label="Security" onPress={() => router.push('/settings/security' as never)} />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Data
        </Typography>
        <SettingsRow label="Export data" onPress={() => router.push('/settings' as never)} />
        <Separator />
        <SettingsRow label="Privacy" onPress={() => router.push('/settings/privacy' as never)} />
      </View>

      <Button
        variant="ghost"
        onPress={leave}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
      >
        <Text style={{ color: tokens.destructive, fontFamily: 'SpaceGrotesk_500Medium' }}>
          Sign out
        </Text>
      </Button>
    </ScrollView>
  );
}
