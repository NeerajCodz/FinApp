import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import type { FinView } from './a2ui';
import type { AgentTool } from './agent';
import { finaiAgent } from './config';
import type { FinaiActionKind, FinaiScopeType } from './validators';

/** What every FinAI tool receives: the action context, the requester and where to reply. */
export type FinaiToolCtx = {
  run: ActionCtx;
  /** The signed-in user (assistant) or the member who mentioned @finai (chats). */
  userId: Id<'users'>;
  scope: { type: FinaiScopeType; id: string };
  /** The reply message the tools' cards and proposals attach to. */
  messageId: string;
  defaultCurrency: string;
};

export type FinaiTool = AgentTool<FinaiToolCtx>;

/** JSON-safe payloads: bigints become integer strings. */
export function encodePayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

/**
 * Stores a write for the user to confirm and returns the card that asks them. Nothing runs
 * until they press Confirm (`ai.actions.confirm`).
 */
export async function propose(
  ctx: FinaiToolCtx,
  input: {
    kind: FinaiActionKind;
    payload: Record<string, unknown>;
    title: string;
    lines: { label: string; value: string }[];
  },
): Promise<{ data: unknown; views: FinView[] }> {
  const actionId: Id<'finaiActions'> = await ctx.run.runMutation(internal.ai.actions.propose, {
    userId: ctx.userId,
    scopeType: ctx.scope.type,
    scopeId: ctx.scope.id,
    messageId: ctx.messageId,
    kind: input.kind,
    payload: encodePayload(input.payload),
    title: input.title,
    ttlMs: finaiAgent.actionTtlMs,
  });
  return {
    data: {
      status: 'awaiting_confirmation',
      actionId,
      summary: input.title,
      note: 'Shown to the user as a confirmation card. Do not claim it is done; ask them to confirm.',
    },
    views: [{ kind: 'action', actionId, title: input.title, lines: input.lines }],
  };
}
