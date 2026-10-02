import React from 'react';
import { AccessibilityInfo, Animated, Easing, Image, View } from 'react-native';
import { ReceiptText } from 'lucide-react-native';
import { resolveAvatarAsset } from '../avatar-assets.native';
import { useTheme } from './ThemeProvider';
import { Text, Typography } from './typography';
export function Avatar({
  initials,
  label,
  size = 42,
  imageUrl,
  avatarId,
}: {
  initials: string;
  label?: string;
  size?: number;
  imageUrl?: string | null;
  avatarId?: string;
}) {
  const { tokens } = useTheme();
  const localImage = resolveAvatarAsset(avatarId, size);
  const imageSource = localImage ?? (imageUrl ? { uri: imageUrl } : undefined);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label ?? initials}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.surfaceRaised,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imageSource ? (
        <Image
          source={imageSource}
          resizeMode="cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <Text
          style={{
            color: tokens.foreground,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: size * 0.32,
          }}
        >
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export function Separator() {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={{ height: 1, backgroundColor: tokens.borderSubtle, width: '100%' }}
    />
  );
}

export function Progress({
  value,
  color,
  height = 6,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const { tokens } = useTheme();
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: normalized }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: tokens.borderSubtle,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${normalized}%`,
          height: '100%',
          backgroundColor: color ?? tokens.foreground,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 18,
}: {
  width?: number | `${number}%`;
  height?: number;
}) {
  const { tokens } = useTheme();
  const opacity = React.useRef(new Animated.Value(0.55)).current;
  React.useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.55,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={{
        width,
        height,
        opacity,
        borderRadius: 10,
        backgroundColor: tokens.surfaceRaised,
      }}
    />
  );
}

export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Empty state"
      style={{
        minHeight: 260,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 32,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: tokens.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        {icon ?? <ReceiptText size={28} color={tokens.foregroundMuted} />}
      </View>
      <Typography variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Typography>
      {description && (
        <Text
          style={{
            color: tokens.foregroundMuted,
            lineHeight: 22,
            maxWidth: 300,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      )}
      {action && <View style={{ marginTop: 10, alignItems: 'center' }}>{action}</View>}
    </View>
  );
}

export function Toast({ message }: { message: string }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        padding: 14,
        borderRadius: 13,
        backgroundColor: tokens.foreground,
      }}
    >
      <Text style={{ color: tokens.background }}>{message}</Text>
    </View>
  );
}
