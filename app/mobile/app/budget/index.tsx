import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import {
  Button,
  Empty,
  IconButton,
  Progress,
  SectionHeader,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function BudgetScreen() {
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
        <Typography variant="title" style={{ flex: 1 }}>
          Budget
        </Typography>
        <IconButton
          label="New budget"
          variant="ghost"
          onPress={() => router.push('/budget/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>

      <View style={{ gap: 10 }}>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Text style={{ color: tokens.foregroundMuted }}>spent of ₹0</Text>
        <Typography variant="heading">₹0 left</Typography>
      </View>
      <Progress value={0} color={tokens.primary} />

      <View style={{ gap: 12 }}>
        <SectionHeader title="Categories" />
        <Empty
          title="No budget yet."
          description="Set one monthly limit or focus on a category that needs attention."
          action={
            <Button size="sm" variant="outline" onPress={() => router.push('/budget/new' as never)}>
              Create budget
            </Button>
          }
        />
      </View>
    </ScrollView>
  );
}
