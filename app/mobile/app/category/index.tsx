import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, CaretRight, Plus } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from '@/components/finance';
import { Button, Empty, IconButton, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function CategoriesScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useQuery(api.categories.queries.list);

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
        <Typography variant="title" style={{ flex: 1 }}>
          Categories
        </Typography>
        <IconButton
          label="Add category"
          variant="ghost"
          onPress={() => router.push('/category/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>

      {categories === undefined ? (
        <Typography variant="small">Loading categories…</Typography>
      ) : categories.length === 0 ? (
        <Empty
          title="No categories yet."
          description="Create a category to organize your income and spending."
          action={
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/category/new' as never)}
            >
              Add category
            </Button>
          }
        />
      ) : (
        (['expense', 'income'] as const).map((kind) => {
          const items = categories.filter((category) => category.kind === kind);
          if (items.length === 0) return null;
          return (
            <View key={kind} style={{ gap: 12 }}>
              <Typography variant="label">{kind === 'expense' ? 'Expenses' : 'Income'}</Typography>
              <View>
                {items.map((category, index) => (
                  <React.Fragment key={category._id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${category.name} category`}
                      onPress={() => router.push(`/category/${category._id}` as never)}
                      style={({ pressed }) => ({
                        minHeight: 64,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <CategoryIcon label={category.name} />
                      <Typography
                        variant="bodyLarge"
                        numberOfLines={1}
                        style={{ flex: 1, fontSize: 15 }}
                      >
                        {category.name}
                      </Typography>
                      <CaretRight size={18} color={tokens.foregroundSubtle} />
                    </Pressable>
                    {index < items.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        gap: 24,
      }}
    >
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Empty
        title="Could not load categories."
        description={error.message}
        action={
          <Button size="sm" variant="outline" onPress={retry}>
            Try again
          </Button>
        }
      />
    </View>
  );
}
