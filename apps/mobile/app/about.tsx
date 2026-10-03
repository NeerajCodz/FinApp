import React from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart } from '@finapp/ui/icons/native';
import { IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import appIcon from '../assets/icon.png';

const DEVELOPER_URL = 'https://github.com/NeerajCodz';

export default function AboutScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

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

      <Image
        source={appIcon}
        accessible
        accessibilityLabel="Finapp app logo"
        style={{ width: 96, height: 96, borderRadius: 22, alignSelf: 'center' }}
      />

      <View style={{ gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Typography variant="heading">About Finapp</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>v1.1.4</Text>
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
