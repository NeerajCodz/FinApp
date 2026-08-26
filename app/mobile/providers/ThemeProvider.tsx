import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
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
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  const tokens = useMemo(() => createTokens(isDark ? 'dark' : 'light', accent), [accent, isDark]);
  const value = useMemo(
    () => ({ appearance, setAppearance, accent, setAccent, tokens, isDark }),
    [accent, appearance, isDark, tokens],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
