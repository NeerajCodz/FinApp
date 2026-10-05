import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Text, Typography, useTheme } from '@finapp/ui/native';

export type FinanceEmptyKind =
  | 'account'
  | 'budget'
  | 'transaction'
  | 'analytics'
  | 'goal'
  | 'category'
  | 'activity'
  | 'group'
  | 'recurring'
  | 'search'
  | 'contribution'
  | 'invitation'
  | 'people'
  | 'message';

export type FinanceEmptyStateProps = {
  kind: FinanceEmptyKind;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
};

function Illustration({
  kind,
  compact,
  primary,
  foreground,
  muted,
  border,
  surface,
  background,
}: {
  kind: FinanceEmptyKind;
  compact: boolean;
  primary: string;
  foreground: string;
  muted: string;
  border: string;
  surface: string;
  background: string;
}) {
  return (
    <Svg
      width={compact ? 96 : 156}
      height={compact ? 66 : 108}
      viewBox="0 0 192 132"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx="96" cy="66" r="56" fill={surface} />
      {kind === 'account' && (
        <>
          <Rect
            x="43"
            y="39"
            width="106"
            height="64"
            rx="10"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Path d="M43 54h106v16H43z" fill={primary} opacity=".9" />
          <Rect
            x="109"
            y="76"
            width="27"
            height="17"
            rx="5"
            fill={surface}
            stroke={border}
            strokeWidth="1.5"
          />
          <Circle cx="117" cy="84.5" r="2" fill={primary} />
          <Path d="M57 84h37m-37 9h24" stroke={muted} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === 'budget' && (
        <>
          <Rect
            x="49"
            y="35"
            width="94"
            height="68"
            rx="9"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Path
            d="M67 55h58M67 68h58M67 81h58"
            stroke={border}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Path
            d="M67 55h34M67 68h45M67 81h20"
            stroke={primary}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Circle cx="132" cy="91" r="10" fill={primary} />
          <Path
            d="M132 86v10m-3-7h5a2 2 0 0 1 0 4h-5"
            fill="none"
            stroke={background}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'transaction' && (
        <>
          <Path
            d="M61 35h70v70l-9-6-9 6-9-6-9 6-9-6-9 6-9-6-7 6z"
            fill={background}
            stroke={border}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <Path
            d="M75 52h41m-41 13h25m-25 13h34"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="120" cy="84" r="9" fill={primary} />
          <Path d="M117 84h6m-3-3v6" stroke={background} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {kind === 'analytics' && (
        <>
          <Path d="M49 99h94" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <Rect x="59" y="75" width="15" height="24" rx="3" fill={muted} opacity=".55" />
          <Rect x="82" y="59" width="15" height="40" rx="3" fill={primary} opacity=".55" />
          <Rect x="105" y="44" width="15" height="55" rx="3" fill={primary} />
          <Path
            d="m60 66 24-15 19 5 25-21"
            fill="none"
            stroke={foreground}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="128" cy="35" r="5" fill={primary} />
        </>
      )}
      {kind === 'goal' && (
        <>
          <Circle cx="88" cy="66" r="36" fill={background} stroke={border} strokeWidth="2" />
          <Circle cx="88" cy="66" r="25" fill="none" stroke={muted} strokeWidth="2" />
          <Circle cx="88" cy="66" r="13" fill="none" stroke={primary} strokeWidth="3" />
          <Circle cx="88" cy="66" r="4" fill={primary} />
          <Path
            d="m91 63 37-31m-13-2 15-2-2 15"
            fill="none"
            stroke={foreground}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'category' && (
        <>
          <Rect
            x="47"
            y="39"
            width="43"
            height="38"
            rx="8"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Rect
            x="101"
            y="39"
            width="43"
            height="38"
            rx="8"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Rect x="47" y="88" width="43" height="21" rx="7" fill={primary} opacity=".8" />
          <Rect
            x="101"
            y="88"
            width="43"
            height="21"
            rx="7"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Circle cx="68" cy="58" r="10" fill={primary} />
          <Path d="M118 49v18m-9-9h18" stroke={muted} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === 'activity' && (
        <>
          <Path d="M47 100h98" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <Path
            d="m53 86 23-19 17 11 30-33 16 11"
            fill="none"
            stroke={primary}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="76" cy="67" r="4" fill={primary} />
          <Circle cx="123" cy="45" r="5" fill={primary} />
          <Path
            d="M57 47v-8m0 8 7-2m61 45h16"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'group' && (
        <>
          <Circle cx="96" cy="49" r="13" fill={primary} />
          <Circle cx="65" cy="60" r="10" fill={muted} />
          <Circle cx="127" cy="60" r="10" fill={muted} />
          <Path
            d="M72 99c1-17 10-25 24-25s23 8 24 25m-67 0c1-14 7-21 17-22m56 22c-1-14-7-21-17-22"
            fill={background}
            stroke={border}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M77 94c4 3 9 5 19 5s15-2 19-5"
            stroke={primary}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'recurring' && (
        <>
          <Path
            d="M63 58a33 33 0 0 1 57-12l8 9m0 0-1-16m1 16-16-1M129 75a33 33 0 0 1-57 12l-8-9m0 0 1 16m-1-16 16 1"
            fill="none"
            stroke={primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="96" cy="66" r="18" fill={background} stroke={border} strokeWidth="2" />
          <Path
            d="M96 55v12l8 5"
            fill="none"
            stroke={foreground}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'search' && (
        <>
          <Rect
            x="49"
            y="38"
            width="76"
            height="60"
            rx="8"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Path
            d="M64 53h41M64 65h30M64 77h23"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="119" cy="78" r="14" fill={surface} stroke={primary} strokeWidth="3" />
          <Path d="m129 88 10 10" stroke={primary} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {kind === 'contribution' && (
        <>
          <Path d="M54 96h86" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <Rect x="62" y="75" width="20" height="21" rx="4" fill={muted} opacity=".5" />
          <Rect x="88" y="61" width="20" height="35" rx="4" fill={primary} opacity=".65" />
          <Rect x="114" y="46" width="20" height="50" rx="4" fill={primary} />
          <Circle cx="64" cy="45" r="11" fill={primary} />
          <Path
            d="M64 39v12m-4-8h7a2 2 0 0 1 0 4h-7"
            fill="none"
            stroke={background}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'invitation' && (
        <>
          <Rect
            x="43"
            y="44"
            width="106"
            height="62"
            rx="9"
            fill={background}
            stroke={border}
            strokeWidth="2"
          />
          <Path
            d="m46 51 50 37 50-37"
            fill="none"
            stroke={primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="132" cy="38" r="13" fill={primary} />
          <Path
            d="m127 38 4 4 7-8"
            fill="none"
            stroke={background}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'people' && (
        <>
          <Circle cx="96" cy="48" r="14" fill={primary} />
          <Circle cx="64" cy="61" r="10" fill={muted} />
          <Circle cx="128" cy="61" r="10" fill={muted} />
          <Path
            d="M75 99c1-17 8-27 21-27s20 10 21 27m-66 0c1-13 7-21 17-22m56 22c-1-13-7-21-17-22"
            fill={background}
            stroke={border}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Circle cx="143" cy="40" r="11" fill={primary} />
          <Path d="M143 34v12m-6-6h12" stroke={background} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {kind === 'message' && (
        <>
          <Path
            d="M49 39h78a10 10 0 0 1 10 10v33a10 10 0 0 1-10 10H88l-20 15V92h-19a10 10 0 0 1-10-10V49a10 10 0 0 1 10-10"
            fill={background}
            stroke={border}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <Path d="M62 58h54M62 71h37" stroke={muted} strokeWidth="4" strokeLinecap="round" />
          <Circle cx="137" cy="97" r="14" fill={primary} />
          <Path
            d="m132 97 4 4 7-8"
            fill="none"
            stroke={background}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

export function FinanceEmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
}: FinanceEmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 7 : 12,
        minHeight: compact ? undefined : 250,
        paddingVertical: compact ? 10 : 24,
        paddingHorizontal: compact ? 8 : 18,
        borderWidth: compact ? 0 : 1,
        borderColor: tokens.borderSubtle,
        borderRadius: 14,
        backgroundColor: compact ? 'transparent' : tokens.surfaceSubtle,
      }}
    >
      <Illustration
        kind={kind}
        compact={compact}
        primary={tokens.primary}
        foreground={tokens.foreground}
        muted={tokens.foregroundMuted}
        border={tokens.borderSubtle}
        surface={tokens.surfaceRaised}
        background={tokens.background}
      />
      <View style={{ alignItems: 'center', gap: compact ? 3 : 6, maxWidth: 340 }}>
        <Typography
          variant={compact ? 'bodyLarge' : 'heading'}
          style={{ fontSize: compact ? 15 : 21, fontWeight: '600', textAlign: 'center' }}
        >
          {title}
        </Typography>
        <Text
          style={{
            color: tokens.foregroundMuted,
            fontSize: compact ? 12 : 14,
            lineHeight: compact ? 18 : 21,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      </View>
      {action}
    </View>
  );
}
