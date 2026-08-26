import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { accentPalette, type AccentName } from '@/lib/theme/tokens';
import { Button, Card, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, accent, setAccent, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 30, gap: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
        <Typography variant="title">Appearance</Typography>
      </View>
      <View style={{ gap: 10 }}>
        <Typography variant="label">Interface</Typography>
        <Card variant="outline" style={{ gap: 16 }}>
          <View style={{ gap: 5 }}><Typography variant="heading">Theme</Typography><Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>Choose how Finapp feels at a glance.</Text></View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['dark', 'light', 'system'] as const).map((option) => <Button key={option} size="sm" variant={appearance === option ? 'primary' : 'outline'} onPress={() => setAppearance(option)}>{option.charAt(0).toUpperCase() + option.slice(1)}</Button>)}
          </View>
        </Card>
      </View>
      <View style={{ gap: 10 }}>
        <Typography variant="label">Accent</Typography>
        <Card variant="outline" style={{ gap: 16 }}>
          <View style={{ gap: 5 }}><Typography variant="heading">Your signal color</Typography><Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>Used for actions, positive movement, and focus.</Text></View>
          <View style={{ gap: 8 }}>
            {(['blue', 'red', 'white'] as AccentName[]).map((option) => {
              const selected = accent === option;
              return (
                <Button key={option} variant={selected ? 'primary' : 'outline'} onPress={() => setAccent(option)} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: accentPalette[option], borderWidth: option === 'white' ? 1 : 0, borderColor: tokens.border }} />
                    <Text style={{ color: selected ? tokens.primaryForeground : tokens.foreground, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
                  </View>
                  {selected && <Check size={17} color={tokens.primaryForeground} weight="bold" />}
                </Button>
              );
            })}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
