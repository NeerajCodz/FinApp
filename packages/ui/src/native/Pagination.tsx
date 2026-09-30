import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  style?: ViewStyle;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label = 'Pagination',
  style,
}: PaginationProps) {
  const { tokens } = useTheme();
  const pageCount = Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0;
  const requestedPage = Number.isFinite(currentPage) ? Math.floor(currentPage) : 1;
  const page = pageCount === 0 ? 0 : Math.min(pageCount, Math.max(1, requestedPage));
  const previousDisabled = page <= 1;
  const nextDisabled = pageCount === 0 || page >= pageCount;

  const renderControl = (
    controlLabel: string,
    text: string,
    disabled: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={controlLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        {
          borderColor: tokens.border,
          backgroundColor: pressed ? tokens.surfaceRaised : tokens.surfaceSubtle,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: disabled ? tokens.foregroundDisabled : tokens.foreground,
          fontWeight: '500',
        }}
      >
        {text}
      </Text>
    </Pressable>
  );

  return (
    <View accessibilityRole="menu" accessibilityLabel={label} style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.controls}
      >
        {renderControl('Previous page', 'Previous', previousDisabled, () => onPageChange(page - 1))}
        {Array.from({ length: pageCount }, (_, index) => {
          const pageNumber = index + 1;
          const selected = pageNumber === page;
          return (
            <Pressable
              key={pageNumber}
              accessibilityRole="button"
              accessibilityLabel={`Page ${pageNumber}`}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) onPageChange(pageNumber);
              }}
              style={({ pressed }) => [
                styles.control,
                {
                  borderColor: selected ? tokens.primary : tokens.border,
                  backgroundColor: selected
                    ? tokens.primary
                    : pressed
                      ? tokens.surfaceRaised
                      : tokens.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? tokens.primaryForeground : tokens.foreground,
                  fontWeight: selected ? '600' : '500',
                }}
              >
                {pageNumber}
              </Text>
            </Pressable>
          );
        })}
        {renderControl('Next page', 'Next', nextDisabled, () => onPageChange(page + 1))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  control: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
  },
});
