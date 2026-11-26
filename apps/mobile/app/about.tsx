import React from 'react';
import { Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@convex/_generated/api';
import { PRODUCT_VERSION, RELEASE_CHANNEL } from '@convex/shared/version';
import { AboutScreen } from '@finapp/ui/finance';
import {
  RELEASES_URL,
  diagnosticsText,
  releaseNotesFor,
  updateState,
  versionRows,
} from '@finapp/ui/version';
import { CoinLogo } from '@/components/brand/CoinLogo';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function AboutRoute() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useLocalSync();
  const backend = useQuery(api.system.info, {});
  const live = backend ?? (isConnected ? undefined : null);
  const extra = (Constants.expoConfig?.extra ?? {}) as { gitSha?: string };
  const rows = versionRows({
    platform: 'mobile',
    backend: live,
    commit: extra.gitSha,
    environment: __DEV__ ? 'development' : 'production',
  });
  const storeUrl =
    Platform.OS === 'ios'
      ? RELEASES_URL
      : `market://details?id=${Constants.expoConfig?.android?.package ?? ''}`;

  return (
    <AboutScreen
      logo={<CoinLogo size={150} interactive />}
      productVersion={PRODUCT_VERSION}
      channel={RELEASE_CHANNEL}
      rows={rows}
      notes={releaseNotesFor(PRODUCT_VERSION)}
      update={updateState('mobile', live)}
      onUpdate={() =>
        void Linking.openURL(storeUrl).catch(() =>
          Linking.openURL(RELEASES_URL).catch(() => undefined),
        )
      }
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never)
      }
      onOpenPrivacy={() =>
        void Linking.openURL('https://fin.neeraj.fyi/privacy').catch(() => undefined)
      }
      onShareDiagnostics={() =>
        void Share.share({ message: diagnosticsText(rows) }).catch(() => undefined)
      }
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
