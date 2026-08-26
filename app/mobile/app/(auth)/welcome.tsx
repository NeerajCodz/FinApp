import React from 'react';
import { View } from 'react-native';
import { Button, Typography, Text } from '@/components/ui';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Typography variant="title">Finapp</Typography>
      <Text>Money clarity, without the noise.</Text>
      <Button onPress={() => router.push('/(auth)/sign-in')}>Sign in</Button>
      <Button variant="secondary" onPress={() => router.push('/(auth)/sign-up')}>
        Create account
      </Button>
    </View>
  );
}
