'use client';

import '@finapp/ui/web/styles.css';
import { useEffect } from 'react';
import { RouteStatus, primaryButton } from '@/components/feedback/RouteStatus';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'var(--finapp-background)' }}>
        <RouteStatus
          title="Finapp hit a snag."
          description="Reload to continue. Your saved financial data is safe."
          detail={error.digest}
          action={
            <button type="button" style={primaryButton} onClick={() => retry()}>
              Reload
            </button>
          }
        />
      </body>
    </html>
  );
}
