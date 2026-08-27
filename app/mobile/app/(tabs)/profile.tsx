import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { currencies } from '@convex/shared/validators';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsRow } from '@/components/finance';
import { Avatar, Button, Input, Label, Separator, Sheet, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

type Editor = 'username' | 'phone' | null;

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').toLowerCase();
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
          paddingBottom: insets.bottom + 124,
          gap: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Typography variant="title">Profile</Typography>

        <View style={{ gap: 14 }}>
          <Avatar
            initials={(profile?.displayName ?? 'NS').slice(0, 2)}
            label="Your profile"
            size={58}
          />
          <View style={{ gap: 3 }}>
            <Typography variant="heading">{profile?.displayName ?? 'Your profile'}</Typography>
            <Typography variant="small">{profile?.email ?? 'Private ledger'}</Typography>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Typography variant="label">Your share tag</Typography>
          <View
            style={{
              gap: 6,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Typography
              variant="heading"
              style={{ color: profile?.username ? tokens.primary : tokens.foreground }}
            >
              {username}
            </Typography>
            <Text style={{ color: tokens.foregroundMuted }}>
              Use this tag to invite people to groups and split expenses.
            </Text>
          </View>
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 8 }}>
            Identity
          </Typography>
          <SettingsRow label="Username" value={username} onPress={() => openEditor('username')} />
          <Separator />
          <SettingsRow label="Phone number" value={phone} onPress={() => openEditor('phone')} />
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
            label="Currency"
            value={profile?.defaultCurrency ?? 'INR'}
            onPress={() => setCurrencyOpen(true)}
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
          <SettingsRow
            label="Security"
            onPress={() => router.push('/settings/security' as never)}
          />
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 8 }}>
            Data
          </Typography>
          <SettingsRow
            label="Export data"
            onPress={() => router.push('/settings/privacy' as never)}
          />
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
          <Button size="lg" onPress={saveEditor} disabled={!draft.trim()}>
            Save changes
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
