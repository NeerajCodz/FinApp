export type ThemeMode = 'light' | 'dark';
export type AccentName = 'volt';

export const neutralOpacity = {
  white100: '#FFFFFF',
  white80: '#FFFFFFCC',
  white64: '#FFFFFFA3',
  white48: '#FFFFFF7A',
  white32: '#FFFFFF52',
  white20: '#FFFFFF33',
  white12: '#FFFFFF1F',
  white8: '#FFFFFF14',
  white6: '#FFFFFF0F',
  white4: '#FFFFFF0A',
} as const;

export const chartPalette = {
  volt: '#B7FF4A',
  blue: '#5B8CFF',
  violet: '#9D7BFF',
  orange: '#FF9A51',
  pink: '#FF6E9C',
  cyan: '#4EDDD0',
  yellow: '#FFD75A',
} as const;

export const accentPalette: Record<AccentName, string> = {
  volt: chartPalette.volt,
};

export const layoutTokens = {
  screenX: 20,
  sectionGap: 32,
  sectionGapLarge: 40,
  rowGap: 12,
  controlHeight: 54,
  inputHeight: 56,
  radiusSmall: 10,
  radiusControl: 14,
  radiusCard: 18,
  radiusSheet: 28,
} as const;

export const motionTokens = {
  micro: 120,
  standard: 180,
  sheet: 260,
  screen: 280,
  spring: { damping: 24, stiffness: 280 },
} as const;

export type ThemeTokens = {
  background: string;
  foreground: string;
  foregroundStrong: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  foregroundDisabled: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  controlDisabledBackground: string;
  controlDisabledForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  borderSubtle: string;
  input: string;
  ring: string;
  surfaceRaised: string;
  surfaceSubtle: string;
  overlay: string;
  income: string;
  expense: string;
  positive: string;
  warning: string;
  chart: typeof chartPalette;
};

export function createTokens(mode: ThemeMode = 'dark'): ThemeTokens {
  const isDark = mode === 'dark';
  const background = isDark ? '#000000' : '#FFFFFF';
  const foreground = isDark ? '#FFFFFF' : '#000000';
  const inverseOpacity = {
    strong: isDark ? neutralOpacity.white80 : '#000000CC',
    muted: isDark ? neutralOpacity.white64 : '#000000A3',
    subtle: isDark ? neutralOpacity.white48 : '#0000007A',
    disabled: isDark ? neutralOpacity.white32 : '#00000052',
    border: isDark ? neutralOpacity.white12 : '#0000001F',
    borderSubtle: isDark ? neutralOpacity.white8 : '#00000014',
    surfaceRaised: isDark ? neutralOpacity.white6 : '#0000000F',
    surfaceSubtle: isDark ? neutralOpacity.white4 : '#0000000A',
  };

  return {
    background,
    foreground,
    foregroundStrong: inverseOpacity.strong,
    foregroundMuted: inverseOpacity.muted,
    foregroundSubtle: inverseOpacity.subtle,
    foregroundDisabled: inverseOpacity.disabled,
    card: inverseOpacity.surfaceSubtle,
    cardForeground: foreground,
    popover: isDark ? '#080808' : '#F7F7F7',
    popoverForeground: foreground,
    primary: chartPalette.volt,
    primaryForeground: '#000000',
    controlDisabledBackground: isDark ? '#263611' : '#DFEBCB',
    controlDisabledForeground: isDark ? '#FFFFFFA3' : '#0000007A',
    secondary: foreground,
    secondaryForeground: background,
    muted: inverseOpacity.surfaceRaised,
    mutedForeground: inverseOpacity.subtle,
    accent: chartPalette.volt,
    accentForeground: '#000000',
    destructive: '#FF5C5C',
    destructiveForeground: '#FFFFFF',
    border: inverseOpacity.border,
    borderSubtle: inverseOpacity.borderSubtle,
    input: inverseOpacity.surfaceSubtle,
    ring: chartPalette.volt,
    surfaceRaised: inverseOpacity.surfaceRaised,
    surfaceSubtle: inverseOpacity.surfaceSubtle,
    overlay: isDark ? '#000000C7' : '#FFFFFFD9',
    income: foreground,
    expense: foreground,
    positive: chartPalette.volt,
    warning: chartPalette.yellow,
    chart: chartPalette,
  };
}

export const lightTokens = createTokens('light');
export const darkTokens = createTokens('dark');
