import '../global.css';
import React from 'react';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider, useConvexAuth } from '@convex-dev/auth/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Text, View } from '@/components/ui';
import { secureTokenStorage } from '@/lib/auth/session';
import { resolveConvexUrl } from '@/lib/convex-url';

const configuredConvexUrl =
  Constants.expoConfig?.extra?.convexUrl ?? process.env.EXPO_PUBLIC_CONVEX_URL;
const platform = Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';
const convexClient = new ConvexReactClient(resolveConvexUrl(configuredConvexUrl, platform));

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const segments = useSegments();
  const isAuthRoute = segments[0] === '(auth)';
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthRoute) router.replace('/(auth)/welcome');
  }, [isAuthRoute, isAuthenticated, isLoading, router]);
  return <>{children}</>;
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
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return (
    <ConvexAuthProvider client={convexClient} storage={secureTokenStorage}>
      {content}
    </ConvexAuthProvider>
  );
}

export function ErrorFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>Something went wrong. Please try again.</Text>
    </View>
  );
}
