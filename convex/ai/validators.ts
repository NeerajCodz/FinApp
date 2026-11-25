import { v, type Infer } from 'convex/values';

/** Lifecycle of a FinAI reply: placeholder, streaming text, finished, or failed. */
export const finaiReplyStatus = v.union(
  v.literal('pending'),
  v.literal('streaming'),
  v.literal('done'),
  v.literal('error'),
);
export type FinaiReplyStatus = Infer<typeof finaiReplyStatus>;

/** Thinking Orb state shown while a reply is in progress. */
export const finaiStage = v.union(
  v.literal('reasoning'),
  v.literal('working'),
  v.literal('searching'),
);

/** FinAI state on a group or direct message of kind `ai`. */
/** One tool call the agent made, shown as a collapsible step on the reply. */
export const finaiStep = v.object({
  tool: v.string(),
  label: v.string(),
  stage: finaiStage,
  status: v.union(v.literal('running'), v.literal('done'), v.literal('error')),
  startedAt: v.number(),
  durationMs: v.optional(v.number()),
});
export type FinaiStep = Infer<typeof finaiStep>;

export const finaiChatState = v.object({
  /** The member whose `@finai` mention started this reply; only they can confirm its actions. */
  requesterId: v.id('users'),
  /** The mention message being answered. */
  promptMessageId: v.string(),
  status: finaiReplyStatus,
  stage: v.optional(finaiStage),
  stageLabel: v.optional(v.string()),
  /** A2UI v0.9 messages (JSON) for the reply's cards. */
  a2ui: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  steps: v.optional(v.array(finaiStep)),
});
export type FinaiChatState = Infer<typeof finaiChatState>;

export const finaiActionKind = v.union(
  v.literal('transaction.create'),
  v.literal('group.expense.create'),
  v.literal('settlement.create'),
  v.literal('goal.contribute'),
  v.literal('group.nudge'),
  v.literal('transaction.update'),
  v.literal('budget.create'),
  v.literal('budget.update'),
  v.literal('goal.create'),
  v.literal('goal.update'),
  v.literal('category.create'),
  v.literal('category.update'),
  v.literal('account.create'),
  v.literal('account.update'),
  v.literal('recurring.create'),
  /** Moves a budget, goal, category, account or recurring rule to Trash. */
  v.literal('entity.delete'),
  /** Deletes a Trash item for good. */
  v.literal('trash.purge'),
);
export type FinaiActionKind = Infer<typeof finaiActionKind>;

export const finaiActionStatus = v.union(
  v.literal('pending'),
  v.literal('running'),
  v.literal('done'),
  v.literal('cancelled'),
  v.literal('failed'),
  v.literal('expired'),
);
export type FinaiActionStatus = Infer<typeof finaiActionStatus>;

export const finaiScopeType = v.union(
  v.literal('assistant'),
  v.literal('group'),
  v.literal('direct'),
);
export type FinaiScopeType = Infer<typeof finaiScopeType>;
