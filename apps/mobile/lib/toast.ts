import { Alert, Platform, ToastAndroid } from 'react-native';

type ToastOptions = { description?: string };

function show(message: string, options?: ToastOptions) {
  const text = options?.description ? `${message}: ${options.description}` : message;
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(text, ToastAndroid.LONG, ToastAndroid.BOTTOM);
    return;
  }
  Alert.alert(message, options?.description);
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    show(message, options);
  },
  error(message: string, options?: ToastOptions) {
    show(message, options);
  },
};
