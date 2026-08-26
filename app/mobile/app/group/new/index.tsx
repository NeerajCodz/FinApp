import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, UsersThree } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function NewGroupScreen() {
  const [name, setName] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
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
              <UsersThree size={21} color={tokens.foreground} />
            </View>
            <Typography variant="title">Name the group.</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
              Keep it short. Members, currency, and details can be added next.
            </Text>
          </View>
          <View>
            <Label>Group name</Label>
            <Input
              accessibilityLabel="Group name"
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Goa Trip"
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && router.back()}
            />
          </View>
        </View>

        <Button size="lg" disabled={!name.trim()} onPress={() => router.back()}>
          Create group
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
