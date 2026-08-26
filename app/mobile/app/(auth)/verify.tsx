import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, InputOTP, Typography, Text } from '@/components/ui';
import { router } from 'expo-router';

export default function VerifyScreen() {
  const [code, setCode] = useState('');
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Typography variant="title">Verify your email</Typography>
      <Text>Enter the six-digit code we sent you.</Text>
      <InputOTP value={code} onChangeText={setCode} />
      <Input
        accessibilityLabel="Verification code"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      <Button disabled={code.length !== 6} onPress={() => router.replace('/(auth)/onboarding')}>
        Continue
      </Button>
    </View>
  );
}
