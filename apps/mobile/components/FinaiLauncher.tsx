import React from 'react';
import { Pressable, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useConvexAuth } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThinkingOrb, useTheme } from '@finapp/ui/native';

/** Height of the signature tab bar the launcher floats above. */
const TAB_BAR_HEIGHT = 96;

/**
 * FinAI everywhere on the main tabs: a floating orb button above the tab bar that opens the
 * FinAI chat. Hidden outside the tabs so it never covers a form or a chat composer.
 */
export function FinaiLauncher() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { isAuthenticated } = useConvexAuth();
  // Only on the tab screens themselves (not nested routes such as profile settings).
  if (!isAuthenticated || segments[0] !== '(tabs)' || segments.length > 2) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 16, bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask FinAI"
        onPress={() => router.push('/finai' as never)}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 26,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.card,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          shadowColor: '#000000', // theme-exempt: shadows stay black in both themes
          shadowOpacity: 0.3,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <ThinkingOrb state="idle" size={26} />
      </Pressable>
    </View>
  );
}
