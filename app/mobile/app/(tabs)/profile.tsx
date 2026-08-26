import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowRight, ChartLineUp, Gear, UserCircle } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar, Button, Card, SectionHeader, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function ProfileScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 28,
        gap: 22,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 5 }}>
        <Typography variant="label">Workspace</Typography>
        <Typography variant="title">Profile</Typography>
      </View>
      <Card
        style={{
          backgroundColor: tokens.foreground,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 20,
        }}
      >
        <Avatar initials="YU" label="Your profile" size={50} />
        <View style={{ flex: 1, gap: 4 }}>
          <Typography variant="heading" style={{ color: tokens.background }}>
            Your profile
          </Typography>
          <Text style={{ color: tokens.background, opacity: 0.6, fontSize: 12 }}>
            Personal ledger
          </Text>
        </View>
        <UserCircle size={22} color={tokens.background} weight="regular" />
      </Card>
      <View style={{ gap: 10 }}>
        <SectionHeader title="Your tools" />
        <Card variant="outline" style={{ gap: 10 }}>
          <Button
            variant="ghost"
            style={{ justifyContent: 'space-between' }}
            onPress={() => router.push('/analytics' as never)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ChartLineUp size={20} color={tokens.primary} />
              <Text>Analytics</Text>
            </View>
            <ArrowRight size={17} color={tokens.mutedForeground} />
          </Button>
          <Button
            variant="ghost"
            style={{ justifyContent: 'space-between' }}
            onPress={() => router.push('/settings' as never)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Gear size={20} color={tokens.foreground} />
              <Text>Settings</Text>
            </View>
            <ArrowRight size={17} color={tokens.mutedForeground} />
          </Button>
        </Card>
      </View>
      <Card variant="subtle" style={{ gap: 8 }}>
        <Typography variant="heading">A calmer money habit</Typography>
        <Text style={{ color: tokens.mutedForeground, lineHeight: 20 }}>
          Keep the ledger small and the signal clear. Finapp will do the sorting.
        </Text>
      </Card>
    </ScrollView>
  );
}
