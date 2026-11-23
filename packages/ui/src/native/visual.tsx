import React from 'react';
import { AccessibilityInfo, Animated, Easing, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from './ThemeProvider';
import { Text, Typography } from './typography';
import { Avatar, Skeleton } from './feedback';
import { layoutTokens, space, withAlpha, type ThemeTokens } from '../tokens';

/** Semantic colour families shared by tiles, pills and stats. */
export type VisualTone =
  'accent' | 'income' | 'expense' | 'split' | 'settlement' | 'warning' | 'destructive' | 'neutral';

export function toneColor(tokens: ThemeTokens, tone: VisualTone): string {
  if (tone === 'accent') return tokens.primary;
  if (tone === 'neutral') return tokens.foregroundMuted;
  return tokens[tone];
}

/** Rounded, tinted well for an icon — the coloured "tile" from the reference designs. */
export function IconTile({
  children,
  tone = 'accent',
  color,
  size = 44,
  solid = false,
}: {
  children: React.ReactNode;
  tone?: VisualTone;
  /** Overrides the tone, e.g. a category's own colour. */
  color?: string;
  size?: number;
  /** Filled with the tone colour instead of a soft tint. */
  solid?: boolean;
}) {
  const { tokens } = useTheme();
  const base = color ?? toneColor(tokens, tone);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? base : withAlpha(base, 0.14),
      }}
    >
      {children}
    </View>
  );
}

/** Compact status label, e.g. "Settled", "You owe", "Pending". */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: VisualTone }) {
  const { tokens } = useTheme();
  const color = toneColor(tokens, tone);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        paddingHorizontal: space.sm + 2,
        paddingVertical: space.xs,
        borderRadius: 999,
        backgroundColor: withAlpha(color, 0.14),
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: 12, lineHeight: 16, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}

/** Tiny trend line; values are plotted relative to their own min/max. */
export function Sparkline({
  values,
  width = 88,
  height = 30,
  tone = 'accent',
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  tone?: VisualTone;
}) {
  const { tokens } = useTheme();
  const color = toneColor(tokens, tone);
  const id = React.useId().replace(/:/g, '');
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => [
    (index / (values.length - 1)) * width,
    height - 3 - ((value - min) / range) * (height - 6),
  ]);
  const line = points.map(
    ([x, y], index) => `${index ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`,
  );
  const area = `${line.join(' ')} L${width} ${height} L0 ${height} Z`;
  return (
    <Svg width={width} height={height} accessible={false}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${id})`} />
      <Path d={line.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Metric tile: label, value, optional trend and sparkline. */
export function StatTile({
  label,
  value,
  icon,
  tone = 'accent',
  trend,
  series,
  style,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: VisualTone;
  /** e.g. { label: '+12% vs last month', direction: 'up' } */
  trend?: { label: string; direction: 'up' | 'down' | 'flat'; good?: boolean };
  series?: readonly number[];
  style?: ViewStyle;
}) {
  const { tokens } = useTheme();
  const trendColor = !trend
    ? tokens.foregroundMuted
    : trend.direction === 'flat'
      ? tokens.foregroundMuted
      : (trend.good ?? trend.direction === 'up')
        ? tokens.positive
        : tokens.expense;
  return (
    <View
      style={[
        {
          flex: 1,
          minWidth: 150,
          gap: space.md,
          padding: space.lg,
          borderRadius: layoutTokens.radiusCard,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.card,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {icon ? (
          <IconTile tone={tone} size={32}>
            {icon}
          </IconTile>
        ) : null}
        <Typography variant="label" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Typography>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <View style={{ flex: 1, gap: space.xs }}>
          {typeof value === 'string' ? <Typography variant="heading">{value}</Typography> : value}
          {trend ? (
            <Text style={{ color: trendColor, fontSize: 12, lineHeight: 16 }}>
              {trend.direction === 'up' ? '▲ ' : trend.direction === 'down' ? '▼ ' : ''}
              {trend.label}
            </Text>
          ) : null}
        </View>
        {series ? <Sparkline values={series} tone={tone} width={72} height={28} /> : null}
      </View>
    </View>
  );
}

/** Overlapping avatars with a "+N" overflow chip. */
export function AvatarStack({
  people,
  max = 4,
  size = 30,
}: {
  people: readonly { id: string; name: string; imageUrl?: string | null; avatarId?: string }[];
  max?: number;
  size?: number;
}) {
  const { tokens } = useTheme();
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?';
  return (
    <View
      accessibilityLabel={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={{
            marginLeft: index ? -size * 0.3 : 0,
            borderRadius: size,
            borderWidth: 2,
            borderColor: tokens.background,
          }}
        >
          <Avatar
            initials={initials(person.name)}
            size={size}
            imageUrl={person.imageUrl}
            avatarId={person.avatarId}
          />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            marginLeft: -size * 0.3,
            width: size + 4,
            height: size + 4,
            borderRadius: size,
            borderWidth: 2,
            borderColor: tokens.background,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <Text style={{ fontSize: 11, color: tokens.foregroundMuted }}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Feature card with a soft gradient wash in a tone colour. */
export function HeroCard({
  children,
  tone = 'accent',
  style,
}: {
  children: React.ReactNode;
  tone?: VisualTone;
  style?: ViewStyle;
}) {
  const { tokens } = useTheme();
  const color = toneColor(tokens, tone);
  const id = React.useId().replace(/:/g, '');
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: layoutTokens.radiusSheet,
          borderWidth: 1,
          borderColor: withAlpha(color, 0.28),
          backgroundColor: tokens.card,
          padding: space.xl,
          gap: space.md,
        },
        style,
      ]}
    >
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        width="100%"
        height="100%"
        accessible={false}
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.24} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Animated money/number that counts toward its value; respects reduce-motion. */
export function CountUp({
  value,
  format,
  duration = 600,
  style,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
  style?: React.ComponentProps<typeof Text>['style'];
}) {
  const animated = React.useRef(new Animated.Value(value)).current;
  const [shown, setShown] = React.useState(value);
  React.useEffect(() => {
    let active = true;
    const listener = animated.addListener(({ value: next }) => active && setShown(next));
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        animated.setValue(value);
        return;
      }
      Animated.timing(animated, {
        toValue: value,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => {
      active = false;
      animated.removeListener(listener);
    };
  }, [animated, duration, value]);
  return (
    <Text accessibilityLabel={format(value)} style={style}>
      {format(shown)}
    </Text>
  );
}

/** Placeholder rows that match list layout while data loads. */
export function ListSkeleton({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: space.lg }}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {avatar ? <Skeleton width={42} height={42} /> : null}
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width={index % 2 ? '55%' : '70%'} height={14} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  );
}
