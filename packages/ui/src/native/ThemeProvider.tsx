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
import { createTokens, type ThemeMode, type ThemeTokens } from '../tokens';

type Appearance = 'system' | ThemeMode;
const APPEARANCE_KEY = 'finapp.appearance.mode.v1';

function savedAppearance(): Appearance {
  const value = Storage.getItemSync(APPEARANCE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

type ThemeContextValue = {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  tokens: ThemeTokens;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, updateAppearance] = useState<Appearance>(savedAppearance);
  const setAppearance = useCallback((value: Appearance) => {
    Storage.setItemSync(APPEARANCE_KEY, value);
    updateAppearance(value);
  }, []);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const isDark = appearance === 'dark' || (appearance === 'system' && system !== 'light');
  const tokens = useMemo(() => createTokens(isDark ? 'dark' : 'light'), [isDark]);
  const value = useMemo(
    () => ({ appearance, setAppearance, tokens, isDark }),
    [appearance, setAppearance, isDark, tokens],
  );

  if (!fontsLoaded) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
