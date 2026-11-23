import { Alert, Platform, ToastAndroid } from 'react-native';
import { hasToastViewport, showToast, type ToastInput } from '@finapp/ui/native';

type ToastOptions = { description?: string; action?: ToastInput['action']; duration?: number };

function show(tone: NonNullable<ToastInput['tone']>, message: string, options?: ToastOptions) {
  if (hasToastViewport()) {
    showToast({ title: message, tone, ...options });
    return;
  }
  // Before the app shell mounts (e.g. very early errors), fall back to platform UI.
  const text = options?.description ? `${message}: ${options.description}` : message;
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(text, ToastAndroid.LONG, ToastAndroid.BOTTOM);
    return;
  }
  Alert.alert(message, options?.description);
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    show('success', message, options);
  },
  error(message: string, options?: ToastOptions) {
    show('error', message, options);
  },
  info(message: string, options?: ToastOptions) {
    show('info', message, options);
  },
};
