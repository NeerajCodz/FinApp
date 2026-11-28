export type PushRegistrationStatus = 'checking' | 'registered' | 'failed' | 'offline';

export interface PushRegistrationQueue {
  request(): Promise<void>;
}

interface PushRegistrationQueueOptions {
  isConnected(): boolean;
  register(): Promise<unknown>;
  setStatus(status: PushRegistrationStatus): void;
}

export function createPushRegistrationQueue({
  isConnected,
  register,
  setStatus,
}: PushRegistrationQueueOptions): PushRegistrationQueue {
  let inFlight = false;
  let queued = false;

  return {
    async request() {
      if (inFlight) {
        queued = true;
        return;
      }
      if (!isConnected()) {
        setStatus('offline');
        return;
      }

      inFlight = true;
      try {
        do {
          queued = false;
          if (!isConnected()) {
            setStatus('offline');
            break;
          }
          setStatus('checking');
          try {
            setStatus((await register()) === 'registered' ? 'registered' : 'failed');
          } catch {
            setStatus('failed');
          }
        } while (queued && isConnected());
      } finally {
        inFlight = false;
      }
    },
  };
}
