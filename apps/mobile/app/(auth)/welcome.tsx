import React from 'react';
import { Image, View } from 'react-native';
import appIcon from '../../assets/icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';

export default function WelcomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        paddingHorizontal: 20,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <Typography variant="caption" style={{ color: tokens.foregroundMuted, letterSpacing: 0.8 }}>
        PRIVATE MONEY, CLEARLY
      </Typography>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 28,
        }}
      >
        <View
          style={{
            width: 176,
            height: 176,
            borderRadius: 88,
            overflow: 'hidden',
            backgroundColor: tokens.background,
            marginBottom: 30,
          }}
        >
          <Image
            accessibilityLabel="Finapp app icon"
            source={appIcon}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', transform: [{ scale: 2.12 }] }}
          />
        </View>

        <Typography
          style={{
            color: tokens.foreground,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 52,
            lineHeight: 58,
            letterSpacing: -2.2,
          }}
        >
          finapp
        </Typography>
        <Typography
          variant="bodyLarge"
          style={{
            color: tokens.foregroundMuted,
            textAlign: 'center',
            marginTop: 12,
            maxWidth: 290,
          }}
        >
          Your money. Your people. One clear place.
        </Typography>
      </View>

      <View style={{ gap: 10 }}>
        <Button
          accessibilityLabel="Create account"
          size="lg"
          onPress={() => router.push('/(auth)/sign-up')}
        >
          Create account
        </Button>
        <Button
          accessibilityLabel="Log in"
          size="lg"
          variant="outline"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          Log in
        </Button>
        <Typography
          variant="caption"
          style={{ color: tokens.foregroundSubtle, textAlign: 'center', marginTop: 6 }}
        >
          Private by default. Built for everyday money.
        </Typography>
      </View>
    </View>
  );
}
