import '../global.css';
import React from 'react';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider, useConvexAuth } from '@convex-dev/auth/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityInfo, Platform, Text as RNText } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Toaster } from 'sonner-native';
import { Check, Info, LoaderCircle, TriangleAlert, X } from '@/lib/icons';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { View } from '@/components/ui';
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
      <Toaster
        position="bottom-center"
        offset={110}
        visibleToasts={1}
        icons={{
          success: <Check size={18} color="#000000" strokeWidth={2.4} />,
          error: <X size={18} color="#000000" strokeWidth={2.4} />,
          warning: <TriangleAlert size={18} color="#000000" strokeWidth={2.4} />,
          info: <Info size={18} color="#000000" strokeWidth={2.4} />,
          loading: <LoaderCircle size={18} color="#000000" strokeWidth={2.4} />,
        }}
        toastOptions={{
          titleStyle: {
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 13,
            color: '#000000',
          },
          descriptionStyle: {
            fontFamily: 'SpaceGrotesk_400Regular',
            fontSize: 12,
            color: '#000000A3',
          },
          style: {
            backgroundColor: '#FFFFFF',
            borderColor: '#FFFFFF',
            borderWidth: 1,
            borderRadius: 14,
          },
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
    <ConvexAuthProvider client={convexClient} storage={secureTokenStorage}>
      {content}
    </ConvexAuthProvider>
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
