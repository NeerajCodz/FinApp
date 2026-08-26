export type ThemeMode = 'light' | 'dark';
export type AccentName = 'blue' | 'red' | 'white';

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
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
};

export const accentPalette: Record<AccentName, string> = {
  blue: '#2563EB',
  red: '#DC2626',
  white: '#FFFFFF',
};

export function createTokens(mode: ThemeMode, accent: AccentName = 'blue'): ThemeTokens {
  const isDark = mode === 'dark';
  const background = isDark ? '#000000' : '#FFFFFF';
  const foreground = isDark ? '#FFFFFF' : '#000000';
  const accentColor = accentPalette[accent];
  const accentForeground = accent === 'white' ? '#000000' : '#FFFFFF';
  return {
    background,
    foreground,
    card: background,
    cardForeground: foreground,
    popover: background,
    popoverForeground: foreground,
    primary: accentColor,
    primaryForeground: accentForeground,
    secondary: isDark ? '#FFFFFF14' : '#0000000A',
    secondaryForeground: foreground,
    muted: isDark ? '#FFFFFF14' : '#0000000A',
    mutedForeground: isDark ? '#A3A3A3' : '#525252',
    accent: accentColor,
    accentForeground,
    destructive: accentPalette.red,
    destructiveForeground: '#FFFFFF',
    border: isDark ? '#FFFFFF33' : '#00000033',
    borderSubtle: isDark ? '#FFFFFF1F' : '#0000001F',
    input: isDark ? '#080808' : '#FAFAFA',
    ring: accentColor,
    surfaceRaised: isDark ? '#FFFFFF0D' : '#00000005',
    surfaceSubtle: isDark ? '#FFFFFF08' : '#00000003',
    overlay: isDark ? '#000000B8' : '#FFFFFFD9',
    income: accentColor,
    expense: accentPalette.red,
    positive: accentColor,
    warning: accentPalette.red,
  };
}

export const lightTokens = createTokens('light');
export const darkTokens = createTokens('dark');
