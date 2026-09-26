import { ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, IconButton, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';

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
    </ScrollView>
  );
}
