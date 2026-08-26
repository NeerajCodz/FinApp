import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function RecurringScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Recurring</Typography>
      </View>
      <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
        Preview scheduled money before it enters your ledger.
      </Text>
      <Empty
        title="No recurring rules."
        description="Rules you create will appear here with their next date and amount."
      />
    </ScrollView>
  );
}
