import React from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';
import { layoutTokens, motionTokens, space, withAlpha } from '../tokens';

export type ToastTone = 'success' | 'error' | 'info';
export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Optional inline action, e.g. Undo. */
  action?: { label: string; onPress: () => void };
  /** Milliseconds before auto-dismiss; actions get longer by default. */
  duration?: number;
};
type ToastItem = ToastInput & { id: number };

type Listener = (items: ToastItem[]) => void;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener(items));

/** True while a ToastViewport is mounted; callers can fall back to platform UI otherwise. */
export function hasToastViewport(): boolean {
  return listeners.size > 0;
}

export function showToast(input: ToastInput): number {
  const id = nextId++;
  items = [...items.slice(-2), { ...input, id }];
  emit();
  AccessibilityInfo.announceForAccessibility(
    input.description ? `${input.title}. ${input.description}` : input.title,
  );
  return id;
}

export function dismissToast(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { tokens } = useTheme();
  const progress = React.useRef(new Animated.Value(0)).current;
  const color =
    item.tone === 'error'
      ? tokens.destructive
      : item.tone === 'info'
        ? tokens.split
        : tokens.positive;
  const close = React.useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: motionTokens.standard,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onDone);
  }, [onDone, progress]);

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motionTokens.sheet,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timeout = setTimeout(close, item.duration ?? (item.action ? 6000 : 3500));
    return () => clearTimeout(timeout);
  }, [close, item.action, item.duration, progress]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={close}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: layoutTokens.radiusCard,
          borderWidth: 1,
          borderColor: withAlpha(color, 0.35),
          backgroundColor: tokens.popover,
          shadowColor: '#000000', // theme-exempt: shadows stay black in both themes
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, lineHeight: 19 }}>
            {item.title}
          </Text>
          {item.description ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 13, lineHeight: 18 }}>
              {item.description}
            </Text>
          ) : null}
        </View>
        {item.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              item.action!.onPress();
              close();
            }}
          >
            <Text style={{ color: tokens.primary, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Mount once near the app root (inside the theme provider). */
export function ToastViewport({ bottomInset = 0 }: { bottomInset?: number }) {
  const [shown, setShown] = React.useState<ToastItem[]>(items);
  React.useEffect(() => {
    listeners.add(setShown);
    return () => {
      listeners.delete(setShown);
    };
  }, []);
  if (!shown.length) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: bottomInset + space.xl,
        gap: space.sm,
        zIndex: 2000,
        elevation: 20,
      }}
    >
      {shown.map((item) => (
        <ToastCard key={item.id} item={item} onDone={() => dismissToast(item.id)} />
      ))}
    </View>
  );
}
