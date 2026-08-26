import React from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Gear } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, SectionHeader, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupHomeScreen() {
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
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {id ?? 'Group'}
        </Typography>
        <IconButton
          label="Group settings"
          variant="ghost"
          onPress={() => router.push(`/group/${id}/settings` as never)}
        >
          <Gear size={20} color={tokens.foreground} />
        </IconButton>
      </View>

      <View style={{ gap: 8 }}>
        <Typography variant="label">Your balance</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">All settled</Typography>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} onPress={() => router.push('/split/new' as never)}>
          Add expense
        </Button>
        <Button
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push('/settle/new' as never)}
        >
          Settle
        </Button>
      </View>

      <Separator />

      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Balances"
          action={
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/group/${id}/balances` as never)}
            >
              View all
            </Button>
          }
        />
        <Typography variant="small">No outstanding balances.</Typography>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Recent"
          action={
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/group/${id}/expenses` as never)}
            >
              All
            </Button>
          }
        />
        <Empty
          title="No shared records."
          description="Expenses and settlements will appear here."
        />
      </View>
    </ScrollView>
  );
}
