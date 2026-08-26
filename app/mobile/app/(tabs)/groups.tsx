import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Plus } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 124,
        gap: 40,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="title">Groups</Typography>
        <IconButton
          label="Create group"
          variant="ghost"
          onPress={() => router.push('/group/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>

      <View style={{ gap: 10 }}>
        <Typography variant="label">You are owed</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
      </View>

      <View style={{ gap: 12 }}>
        <Typography variant="heading">Shared money, kept clear.</Typography>
        <Empty
          title="No groups yet."
          description="Create one for a trip, home, or any expense shared with people."
          action={
            <Button variant="outline" size="sm" onPress={() => router.push('/group/new' as never)}>
              Create group
            </Button>
          }
        />
      </View>
    </ScrollView>
  );
}
