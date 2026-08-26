import React from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettlementEditor } from '@/components/finance';
import { IconButton } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function NewSettlementScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  async function save() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Settlement complete');
    router.back();
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
      }}
    >
      <View>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
      </View>
      <SettlementEditor onSave={save} />
    </ScrollView>
  );
}
