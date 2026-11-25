import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/lib/tabBar';
import { ThinkingOrb, useTheme } from '@finapp/ui/native';
import { FinaiLogo } from '@finapp/ui/ai';
import { useFinaiActivity } from '@/hooks/useFinaiActivity';
import { toast } from '@/lib/toast';

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
  // Replies keep going after the FinAI screen is closed: toast them on any screen.
  const activity = useFinaiActivity(isAuthenticated, (reply) => {
    const open = () => router.push(`/finai?c=${encodeURIComponent(reply.conversationId)}` as never);
    const options = {
      description: reply.failed ? reply.title : reply.preview || reply.title,
      action: { label: 'Open', onPress: open },
    };
    if (reply.failed) toast.error('FinAI couldn’t finish a reply', options);
    else toast.info('FinAI replied', options);
  });
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
        accessibilityLabel={
          activity.unreadCount > 0
            ? `Ask FinAI, ${activity.unreadCount} new ${activity.unreadCount === 1 ? 'reply' : 'replies'}`
            : 'Ask FinAI'
        }
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
        {/* The orb replaces the logo while a reply is being written, even with the chat closed. */}
        {activity.working ? (
          <ThinkingOrb state="working" size={26} />
        ) : (
          <FinaiLogo size={28} title="FinAI" />
        )}
        {activity.unreadCount > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 5,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.primary,
              borderWidth: 2,
              borderColor: tokens.background,
            }}
          >
            <Text style={{ color: tokens.primaryForeground, fontSize: 11, fontWeight: '700' }}>
              {activity.unreadCount > 9 ? '9+' : activity.unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
