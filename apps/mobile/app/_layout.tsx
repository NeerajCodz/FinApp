import '../global.css';
import React from 'react';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ConvexReactClient, useConvexConnectionState } from 'convex/react';
import { ConvexAuthProvider, useConvexAuth } from '@convex-dev/auth/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityInfo, Platform, Text as RNText } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@finapp/ui/native';
import { Button, View } from '@finapp/ui/native';
import { secureTokenStorage } from '@/lib/auth/session';
import { resolveConvexUrl } from '@/lib/convex-url';
import { BackendConnectionNotice } from '@/components/BackendConnectionNotice';
import { LocalSyncProvider, useLocalSync } from '@/providers/LocalSyncProvider';
import { AppLockProvider } from '@/lib/security/AppLockProvider';
import { readValidatedLocalUserId } from '@/local/identity';

const configuredConvexUrl =
  Constants.expoConfig?.extra?.convexUrl ?? process.env.EXPO_PUBLIC_CONVEX_URL;
const platform = Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';
const convexClient = new ConvexReactClient(resolveConvexUrl(configuredConvexUrl, platform));

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { userId: localUserId } = useLocalSync();
  const connection = useConvexConnectionState();
  const router = useRouter();
  const segments = useSegments();
  const { tokens } = useTheme();
  const isAuthRoute = segments[0] === '(auth)';
  const privateRoute = !isAuthRoute && !localUserId;
  const [authTimedOut, setAuthTimedOut] = React.useState(false);
  const [cachedIdentity, setCachedIdentity] = React.useState<string | null | undefined>();

  React.useEffect(() => {
    let active = true;
    void readValidatedLocalUserId()
      .then((id) => {
        if (active) setCachedIdentity(id);
      })
      .catch(() => {
        // Secure storage errors remain behind the account gate rather than exposing private routes.
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (
      !isLoading &&
      !isAuthenticated &&
      !localUserId &&
      !isAuthRoute &&
      (connection.isWebSocketConnected || cachedIdentity === null)
    )
      router.replace('/(auth)/welcome');
  }, [
    cachedIdentity,
    connection.isWebSocketConnected,
    isAuthRoute,
    isAuthenticated,
    isLoading,
    localUserId,
    router,
  ]);
  React.useEffect(() => {
    if (!privateRoute) {
      setAuthTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setAuthTimedOut(true), 12_000);
    return () => clearTimeout(timeout);
  }, [isLoading, privateRoute]);

  return (
    <AppLockProvider userId={localUserId} authRoute={isAuthRoute}>
      {children}
      {privateRoute && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1000,
            elevation: 10,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            backgroundColor: tokens.background,
          }}
        >
          <RNText
            style={{
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 22,
              textAlign: 'center',
            }}
          >
            {authTimedOut ? 'We couldn’t verify your account.' : 'Checking your account…'}
          </RNText>
          {authTimedOut && (
            <Button variant="outline" onPress={() => router.replace('/(auth)/welcome')}>
              Go to sign in
            </Button>
          )}
        </View>
      )}
      <BackendConnectionNotice isConnected={connection.isWebSocketConnected} tokens={tokens} />
    </AppLockProvider>
  );
}

function ThemedStack() {
  const { tokens } = useTheme();
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar style={tokens.background === '#000000' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.background },
          animation: reduceMotion ? 'none' : 'fade_from_bottom',
          animationDuration: reduceMotion ? 0 : 280,
        }}
      />
    </>
  );
}

function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}
export default function RootLayout() {
  const content = (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppErrorBoundary>
          <AuthGate>
            <ThemedStack />
          </AuthGate>
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider client={convexClient} storage={secureTokenStorage}>
        <LocalSyncProvider>{content}</LocalSyncProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorFallback() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        gap: 10,
        padding: 20,
        backgroundColor: '#000000',
      }}
    >
      <RNText
        style={{
          color: '#FFFFFF',
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 24,
          lineHeight: 29,
        }}
      >
        Finapp stopped here.
      </RNText>
      <RNText style={{ color: '#FFFFFFA3', maxWidth: 300 }}>
        Close and reopen the app. Your saved financial data remains intact.
      </RNText>
    </View>
  );
}
