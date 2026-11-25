import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useConvexAuth, useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@convex/_generated/api';
import { updateRequired } from '@finapp/ui/version';
import type { ThemeTokens } from '@finapp/ui/tokens';

const STORE_URL = 'https://play.google.com/store/apps/details?id=com.neerajcodz.finapp';

/**
 * Asks the user to update when this build is older than the backend's minimum supported
 * mobile version. Nothing shows while the backend is unknown (loading or offline).
 */
export function UpdateRequiredNotice({ tokens }: { tokens: ThemeTokens }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const backend = useQuery(api.system.info, isAuthenticated ? {} : 'skip');
  if (updateRequired('mobile', backend) !== true) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: insets.top + 8,
        zIndex: 1001,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.warning,
        backgroundColor: tokens.popover,
      }}
    >
      <Text accessibilityRole="alert" style={{ flex: 1, color: tokens.foreground, fontSize: 13 }}>
        This version of Finapp is no longer supported. Update to keep syncing.
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(STORE_URL).catch(() => undefined)}
        hitSlop={8}
      >
        <Text style={{ color: tokens.primary, fontWeight: '600' }}>Update</Text>
      </Pressable>
    </View>
  );
}
