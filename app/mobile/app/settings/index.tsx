import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, Bell, CaretRight, CurrencyDollar, LockKey, Palette, ShieldCheck } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, IconButton, SectionHeader, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const settings = [
  { label: 'Appearance', description: 'Theme and accent color', icon: Palette, route: '/settings/appearance' },
  { label: 'Currency', description: 'Default currency and locale', icon: CurrencyDollar, route: '/settings/currency' },
  { label: 'Notifications', description: 'Reminders and updates', icon: Bell, route: '/settings/notifications' },
  { label: 'Security', description: 'App lock and session controls', icon: LockKey, route: '/settings/security' },
  { label: 'Privacy & export', description: 'Data access and CSV export', icon: ShieldCheck, route: '/settings/privacy' },
];

export default function SettingsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 30, gap: 24 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
        <Typography variant="title">Settings</Typography>
      </View>
      <View style={{ gap: 9 }}>
        <Typography variant="label">Preferences</Typography>
        <Card variant="outline" style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
          {settings.map((item, index) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.label}>
                <Pressable accessibilityRole="button" accessibilityLabel={item.label} onPress={() => router.push(item.route as never)} style={({ pressed }) => [{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 10 }, pressed && { opacity: 0.66 }]}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tokens.muted, alignItems: 'center', justifyContent: 'center' }}><Icon size={19} color={tokens.foreground} weight="regular" /></View>
                  <View style={{ flex: 1, gap: 3 }}><Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 }}>{item.label}</Text><Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>{item.description}</Text></View>
                  <CaretRight size={18} color={tokens.mutedForeground} />
                </Pressable>
                {index < settings.length - 1 && <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginLeft: 61 }} />}
              </React.Fragment>
            );
          })}
        </Card>
      </View>
      <Card variant="subtle" style={{ gap: 8 }}>
        <SectionHeader title="Finapp" />
        <Text style={{ color: tokens.mutedForeground, lineHeight: 20 }}>A private ledger for clearer decisions, not more noise.</Text>
        <Typography variant="caption">Version 0.1.0</Typography>
      </Card>
    </ScrollView>
  );
}
