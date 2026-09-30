import React, { useState } from 'react';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { Info, X } from 'lucide-react-native';
import { Text, Typography, useTheme } from '@finapp/ui/native';

/**
 * Native page-header context control. Pass the heading as `title` and its
 * explanatory copy as `description`; the component owns its accessible
 * trigger and dismissible bottom sheet, so callers do not manage open state.
 */
export type InfoDescriptionProps = {
  /** Short heading announced with the trigger and shown as the sheet title. */
  title: string;
  /** Context shown after the user activates the trigger. */
  description: string;
};

export function InfoDescription({ title, description }: InfoDescriptionProps) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`More about ${title}`}
        accessibilityHint="Opens additional information"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 16,
        }}
      >
        <Info size={16} color={tokens.foregroundMuted} />
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss information"
            onPress={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(0,0,0,0.48)',
            }}
          />
          <View
            accessibilityViewIsModal
            accessibilityLabel={`${title} information`}
            style={{
              gap: 12,
              paddingHorizontal: 22,
              paddingTop: 20,
              paddingBottom: 32,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.popover,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Typography variant="heading" style={{ flex: 1, color: tokens.popoverForeground }}>
                {title}
              </Typography>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close information"
                onPress={() => setOpen(false)}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                }}
              >
                <X size={20} color={tokens.popoverForeground} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: tokens.foregroundMuted, lineHeight: 22 }}>{description}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
