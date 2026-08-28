import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Appearance</Typography>
      </View>

      <View style={{ gap: 12 }}>
        <Typography variant="label">Theme</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
          Finapp starts dark. Volt remains the single product accent in every mode.
        </Text>
        <View style={{ gap: 8 }}>
          {(['dark', 'system', 'light'] as const).map((option) => {
            const selected = appearance === option;
            const label = option.charAt(0).toUpperCase() + option.slice(1);
            return (
              <Button
                key={option}
                variant={selected ? 'primary' : 'outline'}
                onPress={() => setAppearance(option)}
                style={{ justifyContent: 'space-between', minHeight: 56 }}
              >
                <Text
                  style={{
                    color: selected ? tokens.primaryForeground : tokens.foreground,
                    fontFamily: 'SpaceGrotesk_500Medium',
                  }}
                >
                  {label}
                </Text>
                {selected && <Check size={18} color={tokens.primaryForeground} />}
              </Button>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Typography variant="label">Signature accent</Typography>
        <View
          style={{
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: tokens.borderSubtle,
          }}
        >
          <View
            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.primary }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="bodyLarge">Volt</Typography>
            <Typography variant="caption">#B7FF4A · Finapp identity</Typography>
          </View>
          <Check size={18} color={tokens.primary} />
        </View>
      </View>
    </ScrollView>
  );
}
