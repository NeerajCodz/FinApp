import React, { createContext, useContext, useMemo, useState } from 'react';
import { useFonts } from 'expo-font';
import { useColorScheme } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  createTokens,
  type AccentName,
  type ThemeMode,
  type ThemeTokens,
} from '@/lib/theme/tokens';

type Appearance = 'system' | ThemeMode;
type ThemeContextValue = {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  accent: AccentName;
  setAccent: (value: AccentName) => void;
  tokens: ThemeTokens;
  isDark: boolean;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearance] = useState<Appearance>('dark');
  const [accent, setAccent] = useState<AccentName>('blue');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  const tokens = useMemo(() => createTokens(isDark ? 'dark' : 'light', accent), [accent, isDark]);
  const value = useMemo(
    () => ({ appearance, setAppearance, accent, setAccent, tokens, isDark }),
    [accent, appearance, isDark, tokens],
  );
  if (!fontsLoaded) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
