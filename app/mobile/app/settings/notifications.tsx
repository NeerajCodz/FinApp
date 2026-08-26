import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Separator, Switch, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function NotificationSettingsScreen() {
  const [budgetWarnings, setBudgetWarnings] = useState(true);
  const [recurringReminders, setRecurringReminders] = useState(true);
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
        <Typography variant="title">Notifications</Typography>
      </View>
      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Money signals
        </Typography>
        <Switch label="Budget warnings" value={budgetWarnings} onValueChange={setBudgetWarnings} />
        <Separator />
        <Switch
          label="Recurring reminders"
          value={recurringReminders}
          onValueChange={setRecurringReminders}
        />
      </View>
      <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
        Finapp only interrupts when a change needs your attention.
      </Text>
    </ScrollView>
  );
}
