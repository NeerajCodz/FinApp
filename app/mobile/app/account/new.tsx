import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, Landmark } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function NewAccountScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>

        <View style={{ flex: 1, justifyContent: 'center', gap: 30 }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: tokens.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Landmark size={21} color={tokens.foreground} />
            </View>
            <Typography variant="title">Add an account.</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
              Give it a familiar name. Finapp never invents card details or bank branding.
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            <View>
              <Label>Name</Label>
              <Input
                accessibilityLabel="Account name"
                autoFocus
                value={name}
                onChangeText={setName}
                placeholder="HDFC Bank"
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Type</Label>
              <Tabs
                value={type}
                onChange={setType}
                tabs={[
                  { label: 'Cash', value: 'cash' },
                  { label: 'Bank', value: 'bank' },
                  { label: 'Card', value: 'card' },
                  { label: 'Wallet', value: 'wallet' },
                ]}
              />
            </View>
          </View>
        </View>

        <Button size="lg" disabled={!name.trim()} onPress={() => router.back()}>
          Save account
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
