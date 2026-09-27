import React from 'react';
import { Button, SectionHeader, Typography, useTheme } from '@finapp/ui/web';
import { CategoryIcon } from '@finapp/ui/finance';

export type DashboardCategory = { id: string; name: string; icon?: string };

export function CategorySection({
  categories,
  loading,
  onSeeAll,
  onOpen,
  onCreate,
}: {
  categories: readonly DashboardCategory[];
  loading: boolean;
  onSeeAll: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <SectionHeader
        title="Categories"
        action={
          <Button variant="ghost" size="sm" onPress={onSeeAll}>
            See all
          </Button>
        }
      />
      {loading ? (
        <Typography variant="small">Loading categories…</Typography>
      ) : categories.length === 0 ? (
        <div style={{ display: 'grid', justifyItems: 'center', paddingBlock: 20, gap: 10 }}>
          <CategoryIcon label="Categories" />
          <Typography variant="bodyLarge">No categories yet</Typography>
          <Typography variant="small" style={{ maxWidth: 290, textAlign: 'center' }}>
            Create a category to organize transactions.
          </Typography>
          <Button size="sm" variant="outline" onPress={onCreate}>
            Add category
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {categories.slice(0, 4).map((category) => (
            <Button
              key={category.id}
              variant="ghost"
              onPress={() => onOpen(category.id)}
              accessibilityLabel={`Open ${category.name} category`}
              style={{
                width: '100%',
                minHeight: 64,
                borderRadius: 14,
                border: `1px solid ${tokens.borderSubtle}`,
                backgroundColor: tokens.surfaceSubtle,
                justifyContent: 'flex-start',
                paddingInline: 12,
              }}
            >
              <span style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12 }}>
                <CategoryIcon label={category.name} icon={category.icon} />
                <Typography
                  variant="bodyLarge"
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    color: tokens.foreground,
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {category.name}
                </Typography>
              </span>
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
