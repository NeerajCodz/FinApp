export type ThemeMode = 'light' | 'dark';
export type AccentName = 'volt' | 'white' | 'blue';
export type AccentValue = AccentName | `#${string}`;

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
  white: '#FFFFFF',
  blue: chartPalette.blue,
};

export function isAccentColor(value: string): value is `#${string}` {
  return /^#[\da-f]{6}$/i.test(value);
}

function contrastForeground(color: string): string {
  const channels = color
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return '#000000';
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

function lightThemeAccent(color: string): string {
  if (contrastForeground(color) === '#FFFFFF') return color;
  const channels = color.match(/[\da-f]{2}/gi);
  if (!channels || channels.length !== 3) return color;
  return `#${channels
    .map((channel) =>
      Math.round(Number.parseInt(channel, 16) * 0.55)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

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
  transfer: string;
  split: string;
  settlement: string;
  chart: typeof chartPalette;
};

export function createTokens(mode: ThemeMode = 'dark', accentValue: string = 'volt'): ThemeTokens {
  const isDark = mode === 'dark';
  const background = isDark ? '#000000' : '#FFFFFF';
  const accentName = Object.prototype.hasOwnProperty.call(accentPalette, accentValue)
    ? (accentValue as AccentName)
    : null;
  const savedAccent = accentName
    ? accentPalette[accentName]
    : isAccentColor(accentValue)
      ? accentValue.toUpperCase()
      : accentPalette.volt;
  const lightAccent = !accentName
    ? lightThemeAccent(savedAccent)
    : accentName === 'volt'
      ? '#365D00'
      : accentName === 'blue'
        ? '#315DBB'
        : '#4B5563';
  const primary = isDark ? savedAccent : lightAccent;
  const primaryForeground = contrastForeground(primary);
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
    primary,
    primaryForeground,
    controlDisabledBackground: isDark ? '#191919' : '#E4E4E4',
    controlDisabledForeground: isDark ? '#FFFFFFA3' : '#0000007A',
    secondary: foreground,
    secondaryForeground: background,
    muted: inverseOpacity.surfaceRaised,
    mutedForeground: inverseOpacity.subtle,
    accent: primary,
    accentForeground: primaryForeground,
    destructive: '#FF5C5C',
    destructiveForeground: '#FFFFFF',
    border: inverseOpacity.border,
    borderSubtle: inverseOpacity.borderSubtle,
    input: inverseOpacity.surfaceSubtle,
    ring: primary,
    surfaceRaised: inverseOpacity.surfaceRaised,
    surfaceSubtle: inverseOpacity.surfaceSubtle,
    overlay: isDark ? '#000000C7' : '#FFFFFFD9',
    income: isDark ? '#4ED37A' : '#187F43',
    expense: isDark ? '#FF6868' : '#C93F43',
    positive: isDark ? '#4ED37A' : '#187F43',
    warning: isDark ? chartPalette.yellow : '#876700',
    transfer: isDark ? chartPalette.yellow : '#876700',
    split: isDark ? '#78A1FF' : '#3568BD',
    settlement: isDark ? chartPalette.orange : '#B95B1C',
    chart: chartPalette,
  };
}

export const lightTokens = createTokens('light');
export const darkTokens = createTokens('dark');
