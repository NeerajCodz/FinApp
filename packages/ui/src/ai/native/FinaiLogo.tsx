import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../native/ThemeProvider';
import { FINAI_LOGO } from '../logo';

/**
 * The FinAI mark in theme colours. The Thinking Orb stays for thinking and working states;
 * this is FinAI's identity (launcher, header, idle avatar).
 */
export function FinaiLogo({
  size = 24,
  title,
  ringColor,
  accentColor,
}: {
  size?: number;
  title?: string;
  ringColor?: string;
  accentColor?: string;
}) {
  const { tokens } = useTheme();
  const { viewBox, ring, ringWidth, spark, dot } = FINAI_LOGO;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      accessibilityRole={title ? 'image' : undefined}
      accessibilityLabel={title}
      accessible={!!title}
    >
      <Path
        d={ring}
        stroke={ringColor ?? tokens.foreground}
        strokeWidth={ringWidth}
        strokeLinecap="round"
      />
      <Path d={spark} fill={accentColor ?? tokens.primary} />
      <Circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={accentColor ?? tokens.primary} />
    </Svg>
  );
}
