'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { nudgeErrorCode, nudgeMessage, type NudgeOutcome } from '@convex/notifications/domain';

/**
 * Sends a payment reminder from the signed-in creditor to a group member who owes them.
 *
 * ```tsx
 * const { nudge, pending } = useNudge();
 * <Button disabled={pending} onPress={() => void nudge(groupId, member.userId, member.name)}>
 *   Remind
 * </Button>
 * ```
 * Shows a toast with the outcome and resolves with it; the server allows one reminder per pair
 * per day and only while the member owes the caller.
 */
export function useNudge() {
  const send = useMutation(api.notifications.mutations.nudge);
  const [pending, setPending] = React.useState(false);
  const nudge = React.useCallback(
    async (groupId: string, userId: string, name?: string): Promise<NudgeOutcome> => {
      setPending(true);
      let outcome: NudgeOutcome;
      try {
        const result = await send({
          groupId: groupId as Id<'groups'>,
          userId: userId as Id<'users'>,
        });
        outcome = { status: result.status };
      } catch (error) {
        outcome = { status: 'error', code: nudgeErrorCode(error) };
      } finally {
        setPending(false);
      }
      const message = nudgeMessage(outcome, name);
      if (outcome.status === 'error') toast.error(message);
      else if (outcome.status === 'sent') toast.success(message);
      else toast(message);
      return outcome;
    },
    [send],
  );
  return { nudge, pending };
}
