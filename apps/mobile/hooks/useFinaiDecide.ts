import * as React from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { toast } from '@/lib/toast';
import { finaiErrorMessage } from '@finapp/ui/ai/finai';

/** Confirms or cancels a FinAI card as the signed-in user, with toasts for the outcome. */
export function useFinaiDecide() {
  const confirm = useAction(api.ai.actions.confirm);
  const cancel = useMutation(api.ai.actions.cancel);
  return React.useCallback(
    async (actionId: string, decision: 'confirm' | 'cancel') => {
      const id = actionId as Id<'finaiActions'>;
      try {
        if (decision === 'cancel') {
          await cancel({ actionId: id });
          return;
        }
        const result = await confirm({ actionId: id });
        if (result.status === 'done') toast.success('Done');
        else toast.error(finaiErrorMessage(result.errorCode));
      } catch (cause) {
        const code =
          cause && typeof cause === 'object' && 'data' in cause
            ? String((cause as { data?: { code?: string } }).data?.code ?? '')
            : cause instanceof Error
              ? (/[A-Z_]{4,}/.exec(cause.message)?.[0] ?? '')
              : '';
        toast.error(finaiErrorMessage(code));
      }
    },
    [cancel, confirm],
  );
}
