import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { Filter } from '@finapp/ui/icons/native';
import { Typography } from './typography';
import { useTheme } from './ThemeProvider';
import type { QuickFilterGroup } from '../quickFilters';

function FilterGroup({ group }: { group: QuickFilterGroup }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Typography variant="caption">{group.label.toUpperCase()}</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {group.options.map((option) => {
          const selected = option.value === group.value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => group.onChange(option.value)}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: selected ? tokens.primary : tokens.borderSubtle,
                backgroundColor: selected ? tokens.surfaceSubtle : 'transparent',
                paddingHorizontal: 11,
                paddingVertical: 8,
              }}
            >
              <Typography
                variant="caption"
                style={{ color: selected ? tokens.primary : tokens.foreground }}
              >
                {option.label}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function QuickFiltersPopover({ groups }: { groups: readonly QuickFilterGroup[] }) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Filter"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: tokens.foregroundMuted,
          paddingHorizontal: 2,
        }}
      >
        <Filter size={15} color={tokens.foreground} />
        <Typography variant="small">Filter</Typography>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Pressable
            onPress={close}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: '#0009',
            }}
          />
          <View
            accessibilityLabel="Filters"
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: '88%',
              gap: 16,
              padding: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
              elevation: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="heading">Filters</Typography>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={close}
              >
                <Typography variant="bodyLarge">×</Typography>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <FilterGroup key={group.id} group={group} />
              ))}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={close}
              style={{
                alignSelf: 'flex-end',
                borderRadius: 10,
                backgroundColor: tokens.primary,
                paddingHorizontal: 15,
                paddingVertical: 10,
              }}
            >
              <Typography variant="small" style={{ color: tokens.primaryForeground }}>
                Done
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
