import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@finapp/ui/native';

export default function AuthLayout() {
  return (
    <ThemeProvider forcedMode="dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
    </ThemeProvider>
  );
}
