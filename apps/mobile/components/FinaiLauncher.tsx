import React from 'react';
import { Pressable, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/lib/tabBar';
import { useTheme } from '@finapp/ui/native';
import { FinaiLogo } from '@finapp/ui/ai';

/**
 * FinAI everywhere on the main tabs: a floating orb button above the tab bar that opens the
 * FinAI chat. Hidden outside the tabs so it never covers a form or a chat composer.
 */
export function FinaiLauncher() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { isAuthenticated } = useConvexAuth();
  const finaiSettings = useQuery(api.ai.settings.get, isAuthenticated ? {} : 'skip');
  // Only on the tab screens themselves (not nested routes such as profile settings).
  if (!isAuthenticated || segments[0] !== '(tabs)' || segments.length > 2) return null;
  if (finaiSettings && (!finaiSettings.enabled || !finaiSettings.showLauncher)) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 16, bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
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
        <FinaiLogo size={28} title="FinAI" />
      </Pressable>
    </View>
  );
}
