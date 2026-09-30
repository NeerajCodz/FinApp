'use client';

import { Button } from '@finapp/ui/web';

export function ActivityStatus({
  message,
  alert = false,
  onRetry,
}: {
  message: string;
  alert?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="activity-status" role={alert ? 'alert' : 'status'}>
      <span className={`activity-status-dot${alert ? ' attention' : ''}`} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline" onPress={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
