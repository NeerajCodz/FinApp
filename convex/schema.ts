import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import {
  finaiActionKind,
  finaiActionStatus,
  finaiChatState,
  finaiStep,
  finaiReplyStatus,
  finaiScopeType,
  finaiStage,
} from './ai/validators';

const timestamp = v.number();
const role = v.union(v.literal('owner'), v.literal('admin'), v.literal('member'));
const currency = v.string();
const optionalText = v.optional(v.string());
const optionalTime = v.optional(v.number());

/**
 * A line item (sub-record) embedded on a transaction. Amounts are line totals and add up to
 * the transaction amount; `participantIds` lists who shares the item in an itemized group
 * split (absent or empty: everyone on the expense).
 */
export const lineItemValidator = v.object({
  id: v.string(),
  title: v.string(),
  amountMinor: v.int64(),
  quantity: v.optional(v.number()),
  participantIds: v.optional(v.array(v.id('users'))),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: optionalText,
    image: optionalText,
    email: optionalText,
    emailVerificationTime: optionalTime,
    phone: optionalText,
    phoneVerificationTime: optionalTime,
    isAnonymous: v.optional(v.boolean()),
    identityId: v.optional(v.string()),
    displayName: v.optional(v.string()),
    username: optionalText,
    accent: optionalText,
    avatarId: optionalText,
    gender: v.optional(v.union(v.literal('neutral'), v.literal('male'), v.literal('female'))),
    avatarStorageId: optionalText,
    defaultCurrency: v.optional(currency),
    defaultAccountId: v.optional(v.id('accounts')),
    defaultExpenseCategoryId: v.optional(v.id('categories')),
    defaultIncomeCategoryId: v.optional(v.id('categories')),
    timezone: v.optional(v.string()),
    createdAt: v.optional(timestamp),
    updatedAt: v.optional(timestamp),
    deletedAt: optionalTime,
    signupTwoFactorEnabled: v.optional(v.boolean()),
  })
    .index('email', ['email'])
    .index('by_identityId', ['identityId'])
    .index('by_username', ['username'])
    .index('by_phone', ['phone']),
  userSettings: defineTable({
    userId: v.id('users'),
    currency,
    timezone: v.string(),
    firstDayOfWeek: v.number(),
    financialMonthStart: v.number(),
    language: v.string(),
    appearance: v.union(v.literal('system'), v.literal('light'), v.literal('dark')),
    notificationPreferences: v.any(),
    appLockPreferences: v.any(),
    twoFactorEnabled: v.optional(v.boolean()),
    updatedAt: timestamp,
    showActive: v.optional(v.boolean()),
    showLastSeen: v.optional(v.boolean()),
  }).index('by_user', ['userId']),
  devices: defineTable({
    userId: v.id('users'),
    deviceId: v.string(),
    platform: v.string(),
    lastSeenAt: timestamp,
  }).index('by_user', ['userId']),
  authEmailChallenges: defineTable({
    userId: v.id('users'),
    challengeIdHash: v.string(),
    codeHash: v.string(),
    createdAt: timestamp,
    expiresAt: timestamp,
    attempts: v.number(),
    consumedAt: optionalTime,
  })
    .index('by_user', ['userId'])
    .index('by_challenge', ['challengeIdHash']),
  appLockResetChallenges: defineTable({
    userId: v.id('users'),
    challengeIdHash: v.string(),
    codeHash: v.string(),
    createdAt: timestamp,
    expiresAt: timestamp,
    attempts: v.number(),
    consumedAt: optionalTime,
  })
    .index('by_user', ['userId'])
    .index('by_challenge', ['challengeIdHash']),
  accounts: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    type: v.union(
      v.literal('cash'),
      v.literal('bank'),
      v.literal('card'),
      v.literal('wallet'),
      v.literal('loan'),
      v.literal('other'),
    ),
    customType: optionalText,
    currency,
    openingBalanceMinor: v.int64(),
    icon: optionalText,
    color: optionalText,
    isIncludedInTotal: v.boolean(),
    notes: optionalText,
    provider: optionalText,
    accountNumber: optionalText,
    openedAt: optionalTime,
    includeInAnalytics: v.optional(v.boolean()),
    archivedAt: optionalTime,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner', ['ownerId'])
    .index('by_clientId', ['clientId']),
  accountMembers: defineTable({ accountId: v.id('accounts'), userId: v.id('users'), role })
    .index('by_account', ['accountId'])
    .index('by_user', ['userId']),
  categories: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    kind: v.optional(v.union(v.literal('expense'), v.literal('income'))),
    parentId: optionalText,
    icon: optionalText,
    color: optionalText,
    notes: optionalText,
    includeInBudgets: v.optional(v.boolean()),
    isSystem: v.boolean(),
    archivedAt: optionalTime,
    monthlyLimitMinor: v.optional(v.int64()),
    limitCurrency: v.optional(currency),
    sortOrder: v.number(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner', ['ownerId'])
    .index('by_clientId', ['clientId']),
  transactions: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    accountId: v.id('accounts'),
    type: v.union(
      v.literal('expense'),
      v.literal('income'),
      v.literal('transfer'),
      v.literal('refund'),
      v.literal('adjustment'),
    ),
    amountMinor: v.int64(),
    /** Group expense with other payers: the part charged to the owner's account. */
    accountAmountMinor: v.optional(v.int64()),
    currency,
    categoryId: optionalText,
    title: v.string(),
    merchant: optionalText,
    note: optionalText,
    groupId: optionalText,
    transferAccountId: optionalText,
    occurredAt: timestamp,
    hasTime: v.optional(v.boolean()),
    receiptId: optionalText,
    items: v.optional(v.array(lineItemValidator)),
    status: v.union(v.literal('pending'), v.literal('posted'), v.literal('voided')),
    // Group expense revision for optimistic concurrency; absent means 1.
    version: v.optional(v.number()),
    updatedBy: v.optional(v.id('users')),
    deletedBy: v.optional(v.id('users')),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: optionalTime,
  })
    .index('by_owner_occurredAt', ['ownerId', 'occurredAt'])
    .index('by_owner_category_occurredAt', ['ownerId', 'categoryId', 'occurredAt'])
    .index('by_account', ['accountId'])
    .index('by_transferAccountId', ['transferAccountId'])
    .index('by_group_occurredAt', ['groupId', 'occurredAt'])
    .index('by_clientId', ['clientId']),
  transactionTags: defineTable({ transactionId: v.id('transactions'), tag: v.string() }).index(
    'by_transaction',
    ['transactionId'],
  ),
  receipts: defineTable({
    transactionId: v.id('transactions'),
    ownerId: v.id('users'),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    size: v.number(),
    createdAt: timestamp,
  }).index('by_transaction', ['transactionId']),
  auditEvents: defineTable({
    actorId: v.id('users'),
    entityType: v.string(),
    entityId: v.string(),
    operation: v.string(),
    beforeHash: optionalText,
    afterHash: optionalText,
    occurredAt: timestamp,
  }).index('by_entity', ['entityType', 'entityId']),
  processedMutations: defineTable({
    actorId: v.id('users'),
    clientMutationId: v.string(),
    operation: v.string(),
    resultEntityId: optionalText,
    resultPayload: v.optional(v.any()),
    revision: v.optional(v.int64()),
    serverUpdatedAt: optionalTime,
    createdAt: timestamp,
  }).index('by_actor_clientMutationId', ['actorId', 'clientMutationId']),
  userSyncState: defineTable({
    userId: v.id('users'),
    revision: v.int64(),
    updatedAt: timestamp,
  }).index('by_user', ['userId']),
  syncChanges: defineTable({
    scopeUserId: v.id('users'),
    revision: v.int64(),
    entityType: v.string(),
    documentId: v.string(),
    updatedAt: timestamp,
    deletedAt: optionalTime,
    document: v.optional(v.any()),
    clientMutationId: optionalText,
  })
    .index('by_user_revision', ['scopeUserId', 'revision'])
    .index('by_user_entity_updatedAt', ['scopeUserId', 'entityType', 'updatedAt']),
  groups: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    currency,
    icon: optionalText,
    color: optionalText,
    description: optionalText,
    groupType: optionalText,
    purpose: optionalText,
    location: optionalText,
    startAt: optionalTime,
    endAt: optionalTime,
    messageRetentionMs: optionalTime,
    archivedAt: optionalTime,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner', ['ownerId'])
    .index('by_clientId', ['clientId']),
  groupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role,
    joinedAt: timestamp,
  })
    .index('by_group', ['groupId'])
    .index('by_user', ['userId'])
    .index('by_group_user', ['groupId', 'userId']),
  // Members who left or were removed; keeps names and join history for the ledger.
  formerGroupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role,
    joinedAt: timestamp,
    leftAt: timestamp,
    removedBy: v.optional(v.id('users')),
  })
    .index('by_group', ['groupId'])
    .index('by_group_user', ['groupId', 'userId']),
  // Append-only audit trail of money-moving group events.
  ledgerEvents: defineTable({
    groupId: v.id('groups'),
    actorId: v.id('users'),
    kind: v.union(
      v.literal('expense.created'),
      v.literal('expense.updated'),
      v.literal('expense.deleted'),
      v.literal('expense.membersAdded'),
      v.literal('settlement.created'),
      v.literal('settlement.deleted'),
      v.literal('member.joined'),
      v.literal('member.left'),
      v.literal('member.removed'),
    ),
    entityType: v.union(v.literal('transaction'), v.literal('settlement'), v.literal('member')),
    entityId: v.string(),
    summary: v.string(),
    // Per-member balance change in minor units, as decimal strings keyed by user id.
    balanceDeltas: v.optional(v.record(v.string(), v.string())),
    version: v.optional(v.number()),
    createdAt: timestamp,
  })
    .index('by_group_createdAt', ['groupId', 'createdAt'])
    .index('by_entity', ['entityType', 'entityId']),
  groupInvites: defineTable({
    groupId: v.id('groups'),
    inviterId: v.id('users'),
    inviteeEmail: v.string(),
    inviteeUsername: optionalText,
    inviteePhone: optionalText,
    inviteeUserId: v.optional(v.id('users')),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
    createdAt: timestamp,
  })
    .index('by_group', ['groupId'])
    .index('by_invitee_user_status', ['inviteeUserId', 'status'])
    .index('by_invitee_username', ['inviteeUsername'])
    .index('by_invitee_email', ['inviteeEmail'])
    .index('by_invitee_phone', ['inviteePhone']),
  groupInvitationLinks: defineTable({
    groupId: v.id('groups'),
    creatorId: v.id('users'),
    tokenHash: v.string(),
    expiresAt: timestamp,
    revokedAt: optionalTime,
    createdAt: timestamp,
  })
    .index('by_group', ['groupId'])
    .index('by_token_hash', ['tokenHash']),
  groupMessages: defineTable({
    groupId: v.id('groups'),
    senderId: v.id('users'),
    // `ai`: a FinAI reply to an @finai mention; senderId is the member who asked.
    kind: v.union(v.literal('text'), v.literal('bill'), v.literal('ai')),
    ai: v.optional(finaiChatState),
    text: optionalText,
    storageId: v.optional(v.id('_storage')),
    mimeType: optionalText,
    size: v.optional(v.number()),
    createdAt: timestamp,
    expiresAt: optionalTime,
    // Pins live on the message: one optional pair per row, removed with the message, and the
    // index below lists a thread's pins without a join table.
    pinnedAt: optionalTime,
    pinnedBy: v.optional(v.id('users')),
  })
    .index('by_group_createdAt', ['groupId', 'createdAt'])
    .index('by_group_pinnedAt', ['groupId', 'pinnedAt'])
    .index('by_storage', ['storageId']),
  friendRequests: defineTable({
    requesterId: v.id('users'),
    recipientId: v.id('users'),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('declined'),
      v.literal('canceled'),
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_requester_status', ['requesterId', 'status'])
    .index('by_recipient_status', ['recipientId', 'status'])
    .index('by_pair', ['requesterId', 'recipientId']),
  friendships: defineTable({
    userLowId: v.id('users'),
    userHighId: v.id('users'),
    createdAt: timestamp,
  })
    .index('by_low', ['userLowId'])
    .index('by_high', ['userHighId'])
    .index('by_pair', ['userLowId', 'userHighId']),
  directConversations: defineTable({
    userLowId: v.id('users'),
    userHighId: v.id('users'),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_pair', ['userLowId', 'userHighId'])
    .index('by_high', ['userHighId']),
  directMessages: defineTable({
    conversationId: v.id('directConversations'),
    senderId: v.id('users'),
    // `ai`: a FinAI reply to an @finai mention; senderId is the participant who asked.
    kind: v.union(v.literal('text'), v.literal('image'), v.literal('ai')),
    ai: v.optional(finaiChatState),
    text: optionalText,
    storageId: v.optional(v.id('_storage')),
    mimeType: optionalText,
    size: v.optional(v.number()),
    createdAt: timestamp,
    pinnedAt: optionalTime,
    pinnedBy: v.optional(v.id('users')),
  })
    .index('by_conversation_createdAt', ['conversationId', 'createdAt'])
    .index('by_conversation_pinnedAt', ['conversationId', 'pinnedAt'])
    .index('by_storage', ['storageId']),
  directMessageReactions: defineTable({
    messageId: v.id('directMessages'),
    conversationId: v.id('directConversations'),
    userId: v.id('users'),
    emoji: v.union(v.literal('❤️'), v.literal('👍'), v.literal('😂'), v.literal('😮')),
    createdAt: timestamp,
  })
    .index('by_message_user', ['messageId', 'userId'])
    .index('by_conversation', ['conversationId']),
  groupMessageReactions: defineTable({
    messageId: v.id('groupMessages'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    emoji: v.union(v.literal('❤️'), v.literal('👍'), v.literal('😂'), v.literal('😮')),
    createdAt: timestamp,
  })
    .index('by_message_user', ['messageId', 'userId'])
    .index('by_group', ['groupId']),
  // Legacy per-message receipts; read only as a fallback until a reader has a chatReadPointers row.
  groupMessageReads: defineTable({
    messageId: v.id('groupMessages'),
    groupId: v.id('groups'),
    userId: v.id('users'),
    seenAt: timestamp,
  })
    .index('by_message_user', ['messageId', 'userId'])
    .index('by_group_user', ['groupId', 'userId']),
  presence: defineTable({
    userId: v.id('users'),
    activeUntil: timestamp,
    lastSeenAt: timestamp,
    updatedAt: timestamp,
  }).index('by_user', ['userId']),
  typingIndicators: defineTable({
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    scopeId: v.union(v.id('groups'), v.id('directConversations')),
    userId: v.id('users'),
    typingUntil: timestamp,
    updatedAt: timestamp,
  })
    .index('by_scope_user', ['scopeType', 'scopeId', 'userId'])
    .index('by_scope', ['scopeType', 'scopeId']),
  directUploadTickets: defineTable({
    ticket: v.string(),
    userId: v.id('users'),
    conversationId: v.id('directConversations'),
    createdAt: timestamp,
    usedAt: optionalTime,
  }).index('by_ticket', ['ticket']),
  directMessageReads: defineTable({
    messageId: v.id('directMessages'),
    conversationId: v.id('directConversations'),
    userId: v.id('users'),
    seenAt: timestamp,
  })
    .index('by_message_user', ['messageId', 'userId'])
    .index('by_conversation_user', ['conversationId', 'userId']),
  // One row per reader per thread: every message created at or before lastReadAt counts as seen.
  chatReadPointers: defineTable({
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    scopeId: v.union(v.id('groups'), v.id('directConversations')),
    userId: v.id('users'),
    lastReadAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_scope_user', ['scopeType', 'scopeId', 'userId'])
    .index('by_scope', ['scopeType', 'scopeId']),
  expensePayers: defineTable({
    transactionId: v.id('transactions'),
    userId: v.id('users'),
    amountMinor: v.int64(),
  })
    .index('by_transaction', ['transactionId'])
    .index('by_user', ['userId']),
  expenseParticipants: defineTable({
    transactionId: v.id('transactions'),
    userId: v.id('users'),
    amountMinor: v.int64(),
    method: v.string(),
    basisValue: optionalText,
  })
    .index('by_transaction', ['transactionId'])
    .index('by_user', ['userId']),
  settlements: defineTable({
    clientId: optionalText,
    groupId: v.id('groups'),
    fromUserId: v.id('users'),
    toUserId: v.id('users'),
    amountMinor: v.int64(),
    currency,
    accountId: v.id('accounts'),
    occurredAt: timestamp,
    note: optionalText,
    createdBy: v.optional(v.id('users')),
    createdAt: timestamp,
    deletedAt: optionalTime,
    deletedBy: v.optional(v.id('users')),
  })
    .index('by_group', ['groupId'])
    .index('by_from_user', ['fromUserId'])
    .index('by_to_user', ['toUserId'])
    .index('by_group_occurredAt', ['groupId', 'occurredAt'])
    .index('by_from_user_occurredAt', ['fromUserId', 'occurredAt'])
    .index('by_to_user_occurredAt', ['toUserId', 'occurredAt'])
    .index('by_clientId', ['clientId']),
  budgets: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    amountMinor: v.int64(),
    currency,
    period: v.union(
      v.literal('monthly'),
      v.literal('category'),
      v.literal('account'),
      v.literal('custom'),
    ),
    categoryId: optionalText,
    accountId: optionalText,
    accountIds: v.optional(v.array(v.string())),
    icon: optionalText,
    alertThreshold: v.optional(v.number()),
    notes: optionalText,
    includeInAnalytics: v.optional(v.boolean()),
    startAt: timestamp,
    endAt: timestamp,
    archivedAt: optionalTime,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner_period', ['ownerId', 'startAt'])
    .index('by_clientId', ['clientId']),
  goals: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    icon: optionalText,
    color: optionalText,
    targetAmountMinor: v.int64(),
    currency,
    targetDate: optionalTime,
    accountId: optionalText,
    goalType: optionalText,
    monthlyContributionMinor: v.optional(v.int64()),
    priority: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'))),
    notes: optionalText,
    reminderFrequency: v.optional(
      v.union(v.literal('none'), v.literal('weekly'), v.literal('monthly')),
    ),
    completedAt: optionalTime,
    archivedAt: optionalTime,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner', ['ownerId'])
    .index('by_clientId', ['clientId']),
  goalContributions: defineTable({
    goalId: v.id('goals'),
    ownerId: v.id('users'),
    clientId: optionalText,
    amountMinor: v.int64(),
    currency,
    accountId: optionalText,
    occurredAt: timestamp,
    createdAt: timestamp,
  })
    .index('by_goal', ['goalId'])
    .index('by_owner_occurredAt', ['ownerId', 'occurredAt'])
    .index('by_goal_occurredAt', ['goalId', 'occurredAt'])
    .index('by_clientId', ['clientId']),
  recurringRules: defineTable({
    ownerId: v.id('users'),
    clientId: optionalText,
    name: v.string(),
    template: v.any(),
    frequency: v.union(
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('monthly'),
      v.literal('yearly'),
      v.literal('custom'),
    ),
    interval: v.number(),
    nextOccurrence: timestamp,
    endDate: optionalTime,
    autoCreate: v.boolean(),
    reminderSettings: v.any(),
    enabled: v.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_owner_nextOccurrence', ['ownerId', 'nextOccurrence'])
    .index('by_enabled_nextOccurrence', ['enabled', 'nextOccurrence'])
    .index('by_clientId', ['clientId']),
  notifications: defineTable({
    recipientId: v.id('users'),
    type: v.string(),
    eventKey: optionalText,
    actorId: optionalText,
    entityType: optionalText,
    entityId: optionalText,
    title: v.string(),
    body: v.string(),
    readAt: optionalTime,
    createdAt: timestamp,
  })
    .index('by_recipient_createdAt', ['recipientId', 'createdAt'])
    .index('by_recipient_eventKey', ['recipientId', 'eventKey']),
  mcpOAuthClients: defineTable({
    clientId: v.string(),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: timestamp,
  }).index('by_client_id', ['clientId']),
  mcpOAuthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.id('users'),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    scopes: v.array(v.string()),
    expiresAt: timestamp,
    consumedAt: optionalTime,
    createdAt: timestamp,
  }).index('by_code_hash', ['codeHash']),
  mcpOAuthGrants: defineTable({
    clientId: v.string(),
    userId: v.id('users'),
    scopes: v.array(v.string()),
    createdAt: timestamp,
    revokedAt: optionalTime,
  })
    .index('by_user_createdAt', ['userId', 'createdAt'])
    .index('by_user_client', ['userId', 'clientId']),
  mcpOAuthActivity: defineTable({
    userId: v.id('users'),
    grantId: v.id('mcpOAuthGrants'),
    toolName: v.string(),
    succeeded: v.boolean(),
    createdAt: timestamp,
  }).index('by_user_createdAt', ['userId', 'createdAt']),
  pushDevices: defineTable({
    userId: v.id('users'),
    token: v.string(),
    platform: v.string(),
    deviceId: v.string(),
    lastSeenAt: timestamp,
    disabledAt: optionalTime,
  })
    .index('by_user', ['userId'])
    .index('by_token', ['token']),
  /** Per-user AI requests and token usage per UTC day, for rate limits. */
  aiUsage: defineTable({
    userId: v.id('users'),
    kind: v.union(v.literal('ocr'), v.literal('chat'), v.literal('decision'), v.literal('utility')),
    windowStart: timestamp,
    count: v.number(),
    promptTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    updatedAt: timestamp,
  }).index('by_user_kind_window', ['userId', 'kind', 'windowStart']),
  /** In-app FinAI assistant threads, one owner each. */
  finaiConversations: defineTable({
    userId: v.id('users'),
    title: optionalText,
    preview: optionalText,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).index('by_user_updatedAt', ['userId', 'updatedAt']),
  finaiMessages: defineTable({
    conversationId: v.id('finaiConversations'),
    userId: v.id('users'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    text: v.string(),
    status: finaiReplyStatus,
    stage: v.optional(finaiStage),
    stageLabel: optionalText,
    /** A2UI v0.9 messages (JSON) for the reply's cards. */
    a2ui: optionalText,
    errorCode: optionalText,
    toolsUsed: v.optional(v.array(v.string())),
    /** Tool calls made for this reply, in order. */
    steps: v.optional(v.array(finaiStep)),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).index('by_conversation_createdAt', ['conversationId', 'createdAt']),
  /**
   * Writes FinAI proposed and the user must confirm (or cancel) before they run. Payload is
   * JSON with amounts as integer strings in minor units.
   */
  finaiActions: defineTable({
    userId: v.id('users'),
    scopeType: finaiScopeType,
    scopeId: v.string(),
    messageId: v.string(),
    kind: finaiActionKind,
    payload: v.string(),
    title: v.string(),
    status: finaiActionStatus,
    resultId: optionalText,
    errorCode: optionalText,
    createdAt: timestamp,
    expiresAt: timestamp,
    decidedAt: optionalTime,
  })
    .index('by_message', ['messageId'])
    .index('by_user_status', ['userId', 'status']),
  /** Single-use tickets for receipt images uploaded for AI parsing (deleted after parsing). */
  aiReceiptUploads: defineTable({
    ticket: v.string(),
    userId: v.id('users'),
    createdAt: timestamp,
    usedAt: optionalTime,
    /** The uploaded image, reported by the client right after the upload, for cleanup. */
    storageId: v.optional(v.id('_storage')),
  })
    .index('by_ticket', ['ticket'])
    .index('by_user_createdAt', ['userId', 'createdAt']),
  avatars: defineTable({
    avatarId: v.string(),
    gender: v.union(v.literal('neutral'), v.literal('male'), v.literal('female')),
    storageId: v.optional(v.id('_storage')),
    url: optionalText,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_avatarId', ['avatarId'])
    .index('by_gender_avatarId', ['gender', 'avatarId']),
});
