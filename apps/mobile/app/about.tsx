import React from 'react';
import { Linking, Pressable, ScrollView, Share, View } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { diagnosticsText, versionRows } from '@finapp/ui/version';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart } from '@finapp/ui/icons/native';
import { IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import { CoinLogo } from '@/components/brand/CoinLogo';

const DEVELOPER_URL = 'https://github.com/NeerajCodz';

export default function AboutScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected } = useLocalSync();
  const backend = useQuery(api.system.info, {});
  const extra = (Constants.expoConfig?.extra ?? {}) as { gitSha?: string };
  const rows = versionRows({
    platform: 'mobile',
    backend: backend ?? (isConnected ? undefined : null),
    commit: extra.gitSha,
    environment: __DEV__ ? 'development' : 'production',
  });
  async function shareDiagnostics() {
    try {
      await Share.share({ message: diagnosticsText(rows) });
    } catch {
      // Sharing was dismissed or is unavailable; nothing to do.
    }
  }

  async function openDeveloperLink() {
    try {
      if (await Linking.canOpenURL(DEVELOPER_URL)) {
        await Linking.openURL(DEVELOPER_URL);
      }
    } catch {
      // Keep the screen usable if the platform cannot open external links.
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">About Finapp</Typography>
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <CoinLogo size={180} interactive />
      </View>

      <View style={{ gap: 20 }}>
        <View
          accessibilityLabel="Version information"
          style={{
            gap: 10,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.card,
          }}
        >
          {rows.map((row) => (
            <View
              key={row.label}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}
            >
              <Text style={{ color: tokens.foregroundMuted }}>{row.label}</Text>
              <Text style={{ flexShrink: 1, textAlign: 'right' }}>{row.value}</Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => void shareDiagnostics()}
            style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
          >
            <Text style={{ color: tokens.primary }}>Share diagnostics</Text>
          </Pressable>
        </View>
        <View style={{ gap: 6 }}>
          <Typography variant="label">Developer</Typography>
          <Text
            accessibilityRole="link"
            onPress={openDeveloperLink}
            style={{ color: tokens.primary, textDecorationLine: 'underline' }}
          >
            @NeerajCodz
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: tokens.foregroundMuted }}>Made with</Text>
          <Heart size={16} color={tokens.primary} />
          <Text style={{ color: tokens.foregroundMuted }}>by Neeraj</Text>
        </View>
      </View>
    </ScrollView>
  );
}
