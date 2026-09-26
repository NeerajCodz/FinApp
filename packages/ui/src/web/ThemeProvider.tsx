'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTokens, type ThemeMode, type ThemeTokens } from '../tokens';

type Appearance = ThemeMode | 'system';
type ThemeContextValue = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  tokens: ThemeTokens;
  isDark: boolean;
};

const APPEARANCE_KEY = 'finapp.appearance.mode.v1';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSavedAppearance(): Appearance {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(APPEARANCE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

function tokenVariables(tokens: ThemeTokens): React.CSSProperties {
  return {
    '--finapp-background': tokens.background,
    '--finapp-foreground': tokens.foreground,
    '--finapp-foreground-strong': tokens.foregroundStrong,
    '--finapp-foreground-muted': tokens.foregroundMuted,
    '--finapp-foreground-subtle': tokens.foregroundSubtle,
    '--finapp-foreground-disabled': tokens.foregroundDisabled,
    '--finapp-card': tokens.card,
    '--finapp-card-foreground': tokens.cardForeground,
    '--finapp-popover': tokens.popover,
    '--finapp-popover-foreground': tokens.popoverForeground,
    '--finapp-primary': tokens.primary,
    '--finapp-primary-foreground': tokens.primaryForeground,
    '--finapp-control-disabled-background': tokens.controlDisabledBackground,
    '--finapp-control-disabled-foreground': tokens.controlDisabledForeground,
    '--finapp-secondary': tokens.secondary,
    '--finapp-secondary-foreground': tokens.secondaryForeground,
    '--finapp-muted': tokens.muted,
    '--finapp-muted-foreground': tokens.mutedForeground,
    '--finapp-accent': tokens.accent,
    '--finapp-accent-foreground': tokens.accentForeground,
    '--finapp-destructive': tokens.destructive,
    '--finapp-destructive-foreground': tokens.destructiveForeground,
    '--finapp-border': tokens.border,
    '--finapp-border-subtle': tokens.borderSubtle,
    '--finapp-input': tokens.input,
    '--finapp-ring': tokens.ring,
    '--finapp-surface-raised': tokens.surfaceRaised,
    '--finapp-surface-subtle': tokens.surfaceSubtle,
    '--finapp-overlay': tokens.overlay,
    '--finapp-income': tokens.income,
    '--finapp-expense': tokens.expense,
    '--finapp-positive': tokens.positive,
    '--finapp-warning': tokens.warning,
    '--finapp-transfer': tokens.transfer,
    '--finapp-split': tokens.split,
    '--finapp-settlement': tokens.settlement,
    '--finapp-font-sans': "var(--font-space-grotesk, 'Space Grotesk', 'Avenir Next', sans-serif)",
  } as React.CSSProperties;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep the server and first client render identical; storage is read after hydration.
  const [appearance, updateAppearance] = useState<Appearance>('dark');
  const [systemIsDark, setSystemIsDark] = useState(true);

  useEffect(() => {
    updateAppearance(readSavedAppearance());
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    setSystemIsDark(media?.matches ?? true);
  }, []);

  useEffect(() => {
    if (
      appearance !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent | MediaQueryList) => setSystemIsDark(event.matches);
    update(media);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [appearance]);

  const setAppearance = useCallback((next: Appearance) => {
    updateAppearance(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(APPEARANCE_KEY, next);
      } catch {
        // Appearance still changes for this session when storage is unavailable.
      }
    }
  }, []);

  const isDark = appearance === 'system' ? systemIsDark : appearance === 'dark';
  const tokens = useMemo(() => createTokens(isDark ? 'dark' : 'light'), [isDark]);
  const contextValue = useMemo(
    () => ({ appearance, setAppearance, tokens, isDark }),
    [appearance, setAppearance, tokens, isDark],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <div
        className="finapp-ui-root"
        data-theme={isDark ? 'dark' : 'light'}
        data-appearance={appearance}
        style={tokenVariables(tokens)}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
