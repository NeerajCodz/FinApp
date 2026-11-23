import React from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { motionTokens } from '../tokens';
import { useReducedMotion } from './motion';
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
  const reduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(visible);
  const progress = React.useRef(new Animated.Value(0)).current;
  const drag = React.useRef(new Animated.Value(0)).current;
  const height = React.useRef(480);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? 0 : motionTokens.sheet,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: reduced ? 0 : motionTokens.standard,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [drag, mounted, progress, reduced, visible]);

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > height.current * 0.28 || gesture.vy > 1.1) onClose();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag, onClose],
  );

  if (!mounted) return null;
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height.current, 0] }),
    drag,
  );
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: tokens.overlay }]}
          />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            onLayout={(event) => {
              height.current = event.nativeEvent.layout.height;
            }}
            style={{
              transform: [{ translateY }],
              backgroundColor: tokens.popover,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 28,
              gap: 16,
              borderTopWidth: 1,
              borderColor: tokens.borderSubtle,
              shadowColor: '#000000', // theme-exempt: shadows stay black in both themes
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.55,
              shadowRadius: 40,
            }}
          >
            <View {...responder.panHandlers} style={{ gap: 16, paddingTop: 2 }}>
              <View
                accessibilityHint="Drag down to close"
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
            </View>
            {children}
          </Animated.View>
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
