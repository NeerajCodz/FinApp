import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, accentName, setAccentName, tokens, isDark } = useTheme();
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
          Choose the app theme. System follows your device setting.
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
        <Typography variant="label">Accent</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          White uses dark controls in light mode so buttons and labels stay readable.
        </Text>
        <View>
          {(['volt', 'white'] as const).map((option, index) => {
            const selected = accentName === option;
            return (
              <React.Fragment key={option}>
                {index > 0 && <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />}
                <Button
                  accessibilityLabel={`${option === 'volt' ? 'Volt' : 'White'} accent`}
                  accessibilityState={{ selected }}
                  variant="ghost"
                  onPress={() => setAccentName(option)}
                  style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      marginRight: 14,
                      backgroundColor: option === 'white' ? '#FFFFFF' : '#B7FF4A',
                      borderWidth: option === 'white' && !isDark ? 1 : 0,
                      borderColor: tokens.foregroundSubtle,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Typography variant="bodyLarge" style={{ color: tokens.foreground }}>
                      {option === 'volt' ? 'Volt' : 'White'}
                    </Typography>
                    <Typography variant="caption">
                      {option === 'volt' ? '#B7FF4A · Finapp identity' : '#FFFFFF · Neutral accent'}
                    </Typography>
                  </View>
                  {selected && <Check size={18} color={tokens.foreground} />}
                </Button>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
