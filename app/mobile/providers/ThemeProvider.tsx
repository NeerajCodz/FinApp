import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useFonts } from 'expo-font';
import { useColorScheme } from 'react-native';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import Storage from 'expo-sqlite/kv-store';
import { createTokens, type AccentName, type ThemeMode, type ThemeTokens } from '@/lib/theme/tokens';

type Appearance = 'system' | ThemeMode;
const APPEARANCE_KEY = 'finapp.appearance.mode.v1';
const ACCENT_KEY = 'finapp.appearance.accent.v1';

function savedAppearance(): Appearance {
  const value = Storage.getItemSync(APPEARANCE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}


type ThemeContextValue = {
  appearance: Appearance;
  accentName: AccentName;
  setAccentName: (value: AccentName) => void;
  setAppearance: (value: Appearance) => void;
  tokens: ThemeTokens;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, updateAppearance] = useState<Appearance>(savedAppearance);
  const [accentName, updateAccentName] = useState<AccentName>(
    () => Storage.getItemSync(ACCENT_KEY) === 'white' ? 'white' : 'volt',
  );
  const setAppearance = useCallback((value: Appearance) => {
    Storage.setItemSync(APPEARANCE_KEY, value);
    updateAppearance(value);
  }, []);
  const setAccentName = useCallback((value: AccentName) => {
    Storage.setItemSync(ACCENT_KEY, value);
    updateAccentName(value);
  }, []);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const isDark = appearance === 'dark' || (appearance === 'system' && system !== 'light');
  const tokens = useMemo(() => createTokens(isDark ? 'dark' : 'light', accentName), [isDark, accentName]);
  const value = useMemo(
    () => ({ appearance, setAppearance, accentName, setAccentName, tokens, isDark }),
    [appearance, setAppearance, accentName, setAccentName, isDark, tokens],
  );

  if (!fontsLoaded) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
