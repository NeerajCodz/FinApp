import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { IconButton, Progress, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 36,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">{id ?? 'Goal'}</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">of ₹0</Typography>
      </View>
      <Progress value={0} color={tokens.primary} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Typography variant="caption">0%</Typography>
        <Typography variant="caption">No target date</Typography>
      </View>
      <Text style={{ color: tokens.foregroundMuted }}>Contribution history will appear here.</Text>
    </ScrollView>
  );
}
