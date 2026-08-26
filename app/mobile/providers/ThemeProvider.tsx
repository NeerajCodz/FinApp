import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkTokens, lightTokens, type ThemeTokens } from '@/lib/theme/tokens';

type Appearance = 'system' | 'light' | 'dark';
type ThemeContextValue = {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  tokens: ThemeTokens;
  isDark: boolean;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearance] = useState<Appearance>('system');
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  const value = useMemo(
    () => ({ appearance, setAppearance, tokens: isDark ? darkTokens : lightTokens, isDark }),
    [appearance, isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
