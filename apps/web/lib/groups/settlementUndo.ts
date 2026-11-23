'use client';

import React from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { groupErrorMessage } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { getMappedCloudId } from '@/lib/offline/repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Single seam for undoing a recorded settlement. Today it calls `settlements.remove` directly
 * while online (a freshly queued payment is given a few seconds to sync first) and reports an
 * error offline. Swap the body for the queued `settlement.remove` outbox op once it lands.
 */
export function useUndoSettlement() {
  const { userId, isConnected } = useBrowserSync();
  const remove = useMutation(api.settlements.mutations.remove);
  return React.useCallback(
    async (localIds: readonly string[]) => {
      if (!userId || !localIds.length) return false;
      if (!isConnected) {
        toast.error('Could not undo while offline', {
          description: 'Reconnect, then undo the payment from the group history.',
        });
        return false;
      }
      try {
        for (const localId of localIds) {
          let cloudId: string | null = UUID.test(localId) ? null : localId;
          for (let attempt = 0; !cloudId && attempt < 12; attempt += 1) {
            cloudId = await getMappedCloudId(userId, 'settlement', localId);
            if (!cloudId) await wait(500);
          }
          if (!cloudId) throw new Error('SETTLEMENT_NOT_SYNCED');
          await remove({ settlementId: cloudId as Id<'settlements'> });
        }
        toast.info(localIds.length > 1 ? 'Payments undone' : 'Payment undone', {
          description: 'The balance is open again.',
        });
        return true;
      } catch (cause) {
        toast.error('Could not undo the payment', {
          description: groupErrorMessage(cause, 'Try again from the group history.'),
        });
        return false;
      }
    },
    [isConnected, remove, userId],
  );
}
