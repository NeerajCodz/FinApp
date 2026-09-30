import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import { createCoinRenderer, type CoinRenderer } from '@finapp/ui/coin';
import { createCoinFloat } from '@finapp/ui/coin/motion';
import appIcon from '../../assets/icon.png';

export function CoinLogo({ size = 240, animated = true }: { size?: number; animated?: boolean }) {
  const [available, setAvailable] = useState(false);
  const renderer = useRef<CoinRenderer | null>(null);
  const context = useRef<ExpoWebGLRenderingContext | null>(null);
  const frame = useRef(0);
  const elapsed = useRef(0);
  const previous = useRef(0);
  const focused = useRef(true);
  const reduced = useRef(false);
  const moving = useRef(animated);
  const mounted = useRef(true);
  const synchronise = useRef<() => void>(() => {});

  useEffect(() => {
    mounted.current = true;
    const float = createCoinFloat();
    const draw = () => {
      const gl = context.current;
      if (!gl || !renderer.current) return;
      renderer.current.render(
        moving.current && !reduced.current ? float.sample(elapsed.current) : 0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      );
      gl.endFrameEXP();
    };
    const tick = (timestamp: number) => {
      frame.current = 0;
      if (!mounted.current || !focused.current || AppState.currentState !== 'active') return;
      if (previous.current) elapsed.current += Math.min((timestamp - previous.current) / 1000, 0.1);
      previous.current = timestamp;
      draw();
      if (moving.current && !reduced.current) frame.current = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      previous.current = 0;
      if (!mounted.current || !focused.current || AppState.currentState !== 'active') return;
      draw();
      if (renderer.current && moving.current && !reduced.current)
        frame.current = requestAnimationFrame(tick);
    };
    synchronise.current = sync;
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        reduced.current = value;
        sync();
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!mounted.current) return;
        reduced.current = value;
        sync();
      })
      .catch(() => {});
    const appSubscription = AppState.addEventListener('change', sync);
    sync();
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame.current);
      motionSubscription.remove();
      appSubscription.remove();
      renderer.current?.dispose();
      renderer.current = null;
      context.current = null;
      float.dispose();
    };
  }, []);

  useEffect(() => {
    moving.current = animated;
    synchronise.current();
  }, [animated]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      synchronise.current();
      return () => {
        focused.current = false;
        synchronise.current();
      };
    }, []),
  );

  function onContextCreate(gl: ExpoWebGLRenderingContext) {
    if (!mounted.current) return;
    renderer.current?.dispose();
    context.current = gl;
    try {
      renderer.current = createCoinRenderer(gl);
      setAvailable(true);
      synchronise.current();
    } catch {
      renderer.current = null;
      setAvailable(false);
    }
  }

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Finapp volt coin with a black F"
      pointerEvents="none"
    >
      {!available && <Image source={appIcon} style={styles.fallback} accessibilityElementsHidden />}
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={onContextCreate}
        onLayout={() => synchronise.current()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { width: '100%', height: '100%', resizeMode: 'contain' },
});
