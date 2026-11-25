import * as React from 'react';
import { Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

/** "Finapp on Pixel 8", "Finapp on iPhone" (best effort, no extra permissions). */
export function deviceLabel(): string {
  if (Platform.OS === 'ios') return `Finapp on ${Platform.isPad ? 'iPad' : 'iPhone'}`;
  const constants = Platform.constants as { Model?: string; Brand?: string };
  const model = constants.Model?.trim();
  return `Finapp on ${model || 'Android'}`;
}

/** Labels this app's session for Settings → Security → Devices. */
export function useSessionLabel(signedIn: boolean) {
  const touch = useMutation(api.security.touchSession);
  React.useEffect(() => {
    if (!signedIn) return;
    touch({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      label: deviceLabel(),
    }).catch(() => undefined);
  }, [signedIn, touch]);
}
