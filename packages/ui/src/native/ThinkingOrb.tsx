/**
 * Thinking Orb for React Native: a port of Thinking Orbs (https://thinkingorbs.com, MIT,
 * Copyright (c) 2026 Yogesh; full notice in `../ai/orbModel.ts`) drawn with react-native-svg.
 * The frame maths lives in `orbModel`; this component drives it from an RN `Animated` clock and
 * tints it with the theme's primary token. With reduce motion on it holds still.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { createOrbModel, type ThinkingOrbProps } from '../ai/orbModel';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type { ThinkingOrbProps, ThinkingOrbState } from '../ai/orbModel';

/** Redraws at most this often; dots read smoothly at 30 fps and it halves the work. */
const FRAME_MS = 33;
/** One loop of the shared clock; long enough that the wrap never shows. */
const CLOCK_MS = 6 * 60 * 1000;

export function ThinkingOrb({
  state = 'reasoning',
  size = 20,
  label,
  caption,
  paused = false,
}: ThinkingOrbProps) {
  const { tokens } = useTheme();
  const model = useMemo(() => createOrbModel(state, size), [state, size]);
  const [dots, setDots] = useState(() => model.frame(0));
  const [still, setStill] = useState(false);
  const clock = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setStill(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    setDots(model.frame(0));
    if (paused || still) return;
    let last = 0;
    const id = clock.addListener(({ value }) => {
      const t = value * CLOCK_MS;
      if (t - last < FRAME_MS && t >= last) return;
      last = t;
      setDots(model.frame(t));
    });
    clock.setValue(0);
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: CLOCK_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      clock.removeListener(id);
    };
  }, [clock, model, paused, still]);

  const orb = (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    >
      {dots.map((dot, index) =>
        dot.a < 0.005 ? null : (
          <Circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={tokens.primary}
            fillOpacity={dot.a}
          />
        ),
      )}
    </Svg>
  );
  return (
    <Animated.View
      accessible={Boolean(label)}
      accessibilityRole={label ? 'progressbar' : undefined}
      accessibilityLabel={label}
      aria-busy={!paused}
      style={{ opacity: fade, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <View style={{ width: size, height: size }}>{orb}</View>
      {caption ? (
        <Text style={{ color: tokens.foregroundMuted }} accessibilityLiveRegion="polite">
          {caption}
        </Text>
      ) : null}
    </Animated.View>
  );
}
