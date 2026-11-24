import type { Id } from '../_generated/dataModel';
import type { FinaiActionView } from './actions';
import type { FinaiChatState } from './validators';

/** Client fields for a FinAI reply bubble in a group chat or DM (empty for other messages). */
export function finaiFields(
  message: { _id: string; kind: string; ai?: FinaiChatState },
  actions: Map<string, FinaiActionView[]>,
  viewerId: Id<'users'>,
) {
  if (message.kind !== 'ai' || !message.ai) return {};
  const ai = message.ai;
  return {
    ai: {
      status: ai.status,
      ...(ai.stage ? { stage: ai.stage } : {}),
      ...(ai.stageLabel ? { stageLabel: ai.stageLabel } : {}),
      ...(ai.a2ui ? { a2ui: ai.a2ui } : {}),
      ...(ai.errorCode ? { errorCode: ai.errorCode } : {}),
      requesterId: ai.requesterId,
      isRequester: ai.requesterId === viewerId,
      actions: actions.get(String(message._id)) ?? [],
    },
  };
}
