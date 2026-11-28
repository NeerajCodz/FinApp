import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

/** "Finapp on Pixel 8", "Finapp on iPhone" (best effort, no extra permissions). */
export function deviceLabel(): string {
  if (Platform.OS === 'ios') return `Finapp on ${Platform.isPad ? 'iPad' : 'iPhone'}`;
  const constants = Platform.constants as { Model?: string; Brand?: string };
  const model = constants.Model?.trim();
  return `Finapp on ${model || 'Android'}`;
}

const SESSION_HEARTBEAT_MS = 6 * 60_000;

/** Labels this app's session and refreshes activity while it is in use. */
export function useSessionLabel(signedIn: boolean) {
  const touch = useMutation(api.security.touchSession);
  React.useEffect(() => {
    if (!signedIn) return;
    const heartbeat = () => {
      if (AppState.currentState !== 'active') return;
      void touch({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        label: deviceLabel(),
      }).catch(() => undefined);
    };
    heartbeat();
    const interval = setInterval(heartbeat, SESSION_HEARTBEAT_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') heartbeat();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [signedIn, touch]);
}
