import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Typography } from './typography';
import { Button } from './button';

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
export type AlertDialogProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
};

export function AlertDialog({
  visible,
  onClose,
  title = 'Confirm action',
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: AlertDialogProps) {
  const { tokens } = useTheme();
  const confirm = async () => {
    await onConfirm?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        accessibilityViewIsModal
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close alert dialog"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.overlay }]}
        />
        <View
          accessibilityRole="alert"
          style={{
            width: '100%',
            maxWidth: 440,
            maxHeight: '88%',
            gap: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 20,
            backgroundColor: tokens.popover,
          }}
        >
          <Typography variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body" style={{ color: tokens.foregroundMuted }}>
              {description}
            </Typography>
          ) : null}
          {children}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="outline" size="sm" onPress={onClose}>
              {cancelLabel}
            </Button>
            <Button variant={destructive ? 'destructive' : 'primary'} size="sm" onPress={confirm}>
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
export const Drawer = Sheet;

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);
