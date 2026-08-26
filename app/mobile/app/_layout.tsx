import '../global.css';
import React from 'react';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Text, View } from '@/components/ui';

const convexUrl = Constants.expoConfig?.extra?.convexUrl;
const convex =
  typeof convexUrl === 'string' && convexUrl.startsWith('http')
    ? new ConvexReactClient(convexUrl)
    : null;

function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}

export default function RootLayout() {
  const content = (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppErrorBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return convex ? <ConvexProvider client={convex}>{content}</ConvexProvider> : content;
}

export function ErrorFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>Something went wrong. Please try again.</Text>
    </View>
  );
}
