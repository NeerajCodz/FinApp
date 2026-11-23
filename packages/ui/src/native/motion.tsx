import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { motionTokens } from '../tokens';

/** Live reduce-motion preference; animations should collapse to instant changes when true. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduced(value))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Pressable that scales down slightly while pressed, for tactile cards and tiles. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const reduced = useReducedMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: toValue === 1 ? 6 : 0,
    }).start();
  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        if (!reduced) animate(scaleTo);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduced) animate(1);
        props.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Fades and lifts its children in on mount. Pass `index` in lists for a short stagger.
 * Renders statically when reduce-motion is on.
 */
export function FadeIn({
  children,
  index = 0,
  distance = 12,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motionTokens.screen,
      delay: Math.min(index, 8) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
