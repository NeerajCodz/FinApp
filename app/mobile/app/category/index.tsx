import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from '@/components/finance';
import { IconButton, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment'];

export default function CategoriesScreen() {
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
        <Typography variant="title">Categories</Typography>
      </View>
      <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
        Calm in the ledger, colorful only when data needs distinction.
      </Text>
      <View>
        {categories.map((category, index) => (
          <React.Fragment key={category}>
            <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CategoryIcon label={category} />
              <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
                {category}
              </Typography>
            </View>
            {index < categories.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}
