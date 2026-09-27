import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Typography } from './typography';

export function Sheet({
  visible,
  onClose,
  children,
  title = 'Actions',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.overlay }]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={{
              backgroundColor: tokens.popover,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 28,
              gap: 16,
              borderTopWidth: 1,
              borderColor: tokens.borderSubtle,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.55,
              shadowRadius: 40,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: tokens.foregroundDisabled,
                alignSelf: 'center',
                marginBottom: 4,
              }}
            />
            <Typography variant="heading" style={{ fontSize: 22, lineHeight: 27 }}>
              {title}
            </Typography>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export const Dialog = Sheet;
export const AlertDialog = Sheet;
export const Drawer = Sheet;

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);
