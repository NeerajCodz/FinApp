import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

const timestamp = v.number();
const role = v.union(v.literal('owner'), v.literal('admin'), v.literal('member'));
const currency = v.string();
const optionalText = v.optional(v.string());
const optionalTime = v.optional(v.number());

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
    status: v.union(v.literal('pending'), v.literal('posted'), v.literal('voided')),
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
    kind: v.union(v.literal('text'), v.literal('bill')),
    text: optionalText,
    storageId: v.optional(v.id('_storage')),
    mimeType: optionalText,
    size: v.optional(v.number()),
    createdAt: timestamp,
    expiresAt: optionalTime,
  })
    .index('by_group_createdAt', ['groupId', 'createdAt'])
    .index('by_storage', ['storageId']),
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
    createdAt: timestamp,
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
  pushDevices: defineTable({
    userId: v.id('users'),
    token: v.string(),
    platform: v.string(),
    deviceId: v.string(),
    lastSeenAt: timestamp,
    disabledAt: optionalTime,
  }).index('by_user', ['userId']),
  avatars: defineTable({
    avatarId: v.string(),
    gender: v.union(v.literal('neutral'), v.literal('male'), v.literal('female')),
    storageId: v.id('_storage'),
    url: v.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index('by_avatarId', ['avatarId'])
    .index('by_gender_avatarId', ['gender', 'avatarId']),
});
