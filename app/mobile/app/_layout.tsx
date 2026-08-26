import '../global.css';
import React from 'react';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ConvexProvider, ConvexReactClient, useConvexAuth } from 'convex/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Text, View } from '@/components/ui';

const convexUrl = Constants.expoConfig?.extra?.convexUrl;
const convexClient = new ConvexReactClient(
  typeof convexUrl === 'string' && convexUrl.startsWith('http')
    ? convexUrl
    : 'http://127.0.0.1:3212',
);

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
  return <ConvexProvider client={convexClient}>{content}</ConvexProvider>;
}

export function ErrorFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>Something went wrong. Please try again.</Text>
    </View>
  );
}
