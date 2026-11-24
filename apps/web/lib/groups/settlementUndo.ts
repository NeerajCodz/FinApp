'use client';

import React from 'react';
import { toast } from 'sonner';
import { groupErrorMessage } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

/**
 * Undoes recorded settlements through the offline queue: applied on this device at once and
 * synced to the server (or straight away when online).
 */
export function useUndoSettlement() {
  const { userId, removeSettlement } = useBrowserSync();
  return React.useCallback(
    async (localIds: readonly string[]) => {
      if (!userId || !localIds.length) return false;
      try {
        let queued = false;
        for (const localId of localIds) queued = (await removeSettlement(localId)).queued || queued;
        toast.info(localIds.length > 1 ? 'Payments undone' : 'Payment undone', {
          description: queued
            ? 'Undone on this device. It syncs when you are back online.'
            : 'The balance is open again.',
        });
        return true;
      } catch (cause) {
        toast.error('Could not undo the payment', {
          description: groupErrorMessage(cause, 'Try again.'),
        });
        return false;
      }
    },
    [removeSettlement, userId],
  );
}
