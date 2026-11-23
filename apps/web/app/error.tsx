'use client';

import { useEffect } from 'react';
import { RouteStatus, primaryButton } from '@/components/feedback/RouteStatus';

export default function RouteError({
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
    <RouteStatus
      title="Something went wrong here."
      description="Your saved financial data is safe. Try again, or head back to your dashboard."
      detail={error.digest}
      action={
        <button type="button" style={primaryButton} onClick={() => retry()}>
          Try again
        </button>
      }
    />
  );
}
