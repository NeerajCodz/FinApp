/**
 * Support tickets, Discord-ticket style: a user opens a ticket (category + subject + first
 * message) and talks with staff in a thread. Staff claim or assign, set status and priority,
 * add internal notes (never shown to the user) and use canned replies. Subjects and messages
 * are encrypted at rest; transcripts are kept. Users are notified when staff reply.
 */
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server';
import { createNotification } from '../notifications/mutations';
import { requireUser, getOptionalUser } from '../shared/auth';
import { cryptoContext, decryptOrPlaceholder, encryptText } from '../admin/crypto';
import {
  adminError,
  logAdminAction,
  memberFor,
  requireAdminPermission,
  settingValue,
  userCard,
} from '../admin/guard';
import { trackUsage } from '../admin/usage';
import {
  cleanText,
  isTicketCategory,
  statusAfterMessage,
  SUPPORT_LIMITS,
  TICKET_CATEGORIES,
  type TicketStatus,
} from './domain';

const statusValidator = v.union(
  v.literal('open'),
  v.literal('pending'),
  v.literal('resolved'),
  v.literal('closed'),
);
const priorityValidator = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
);

function supportError(code: string) {
  return new ConvexError({ code });
}

async function nextTicketNumber(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db
    .query('adminSettings')
    .withIndex('by_key', (q) => q.eq('key', 'ticketSequence'))
    .unique();
  const next = (typeof row?.value === 'number' ? row.value : 0) + 1;
  if (row) await ctx.db.patch(row._id, { value: next, updatedAt: Date.now() });
  else
    await ctx.db.insert('adminSettings', {
      key: 'ticketSequence',
      value: next,
      updatedAt: Date.now(),
    });
  return next;
}

const ticketContext = (ticket: Pick<Doc<'supportTickets'>, 'userId'>) =>
  cryptoContext.ticket(String(ticket.userId));

async function ticketSummary(ctx: QueryCtx, ticket: Doc<'supportTickets'>) {
  return {
    id: ticket._id,
    number: ticket.number,
    category: ticket.category,
    categoryLabel:
      TICKET_CATEGORIES[ticket.category as keyof typeof TICKET_CATEGORIES] ?? ticket.category,
    subject: await decryptOrPlaceholder(ticket.subject, ticketContext(ticket)),
    status: ticket.status,
    priority: ticket.priority,
    messageCount: ticket.messageCount,
    lastMessageAt: ticket.lastMessageAt,
    lastAuthor: ticket.lastAuthor,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt ?? null,
  };
}

async function threadFor(ctx: QueryCtx, ticket: Doc<'supportTickets'>, includeInternal: boolean) {
  const messages = await ctx.db
    .query('supportMessages')
    .withIndex('by_ticket_createdAt', (q) => q.eq('ticketId', ticket._id))
    .collect();
  const authors = new Map<string, Awaited<ReturnType<typeof userCard>>>();
  const result = [];
  for (const message of messages) {
    if (message.internal && !includeInternal) continue;
    const key = String(message.authorId);
    if (!authors.has(key)) authors.set(key, await userCard(ctx, message.authorId));
    const card = authors.get(key) ?? null;
    let staffBadge: { name: string; color: string; icon: string | null } | null = null;
    if (message.author === 'staff') {
      const member = await memberFor(ctx, message.authorId);
      const roles = member ? await Promise.all(member.roleIds.map((id) => ctx.db.get(id))) : [];
      const top = roles
        .filter((role): role is Doc<'adminRoles'> => Boolean(role?.hoist))
        .sort((a, b) => b.position - a.position)[0];
      staffBadge = top
        ? { name: top.name, color: top.color, icon: top.icon ?? null }
        : { name: 'Finapp team', color: '#888888', icon: null };
    }
    result.push({
      id: message._id,
      author: message.author,
      internal: message.internal,
      body: await decryptOrPlaceholder(message.body, ticketContext(ticket)),
      createdAt: message.createdAt,
      // Users see staff by role ("Finapp team" fallback), not personal profiles.
      user:
        message.author === 'user' || includeInternal
          ? card
          : card
            ? { ...card, username: null }
            : null,
      staffBadge,
    });
  }
  return result;
}

async function appendMessage(
  ctx: MutationCtx,
  ticket: Doc<'supportTickets'>,
  authorId: Id<'users'>,
  author: 'user' | 'staff' | 'system',
  body: string,
  internalNote: boolean,
) {
  const now = Date.now();
  const id = await ctx.db.insert('supportMessages', {
    ticketId: ticket._id,
    authorId,
    author,
    internal: internalNote,
    body: await encryptText(body, ticketContext(ticket)),
    createdAt: now,
  });
  if (!internalNote && author !== 'system') {
    await ctx.db.patch(ticket._id, {
      messageCount: ticket.messageCount + 1,
      lastMessageAt: now,
      lastAuthor: author,
      status: statusAfterMessage(ticket.status, author),
      userUnread: author === 'staff',
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(ticket._id, { updatedAt: now });
  }
  return id;
}

// ---------- User side ----------

export const categories = query({
  args: {},
  handler: async () =>
    Object.entries(TICKET_CATEGORIES).map(([value, label]) => ({ value, label })),
});

export const create = mutation({
  args: { category: v.string(), subject: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw supportError('AUTH_REQUIRED');
    if (!(await settingValue(ctx, 'supportOpen', true))) throw supportError('SUPPORT_CLOSED');
    if (!isTicketCategory(args.category)) throw supportError('SUPPORT_CATEGORY_INVALID');
    const subject = cleanText(args.subject, SUPPORT_LIMITS.subjectMax);
    const message = cleanText(args.message, SUPPORT_LIMITS.messageMax);
    if (!subject || !message) throw supportError('SUPPORT_TEXT_INVALID');
    const open = await ctx.db
      .query('supportTickets')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', user._id))
      .collect();
    if (
      open.filter((ticket) => ticket.status === 'open' || ticket.status === 'pending').length >=
      SUPPORT_LIMITS.openTicketsPerUser
    )
      throw supportError('SUPPORT_TOO_MANY_OPEN');
    const now = Date.now();
    const context = cryptoContext.ticket(String(user._id));
    const ticketId = await ctx.db.insert('supportTickets', {
      number: await nextTicketNumber(ctx),
      userId: user._id,
      category: args.category,
      subject: await encryptText(subject, context),
      status: 'open',
      priority: 'normal',
      messageCount: 0,
      lastMessageAt: now,
      lastAuthor: 'user',
      userUnread: false,
      createdAt: now,
      updatedAt: now,
    });
    const ticket = (await ctx.db.get(ticketId))!;
    await appendMessage(ctx, ticket, user._id, 'user', message, false);
    await trackUsage(ctx, user._id, 'support.ticket');
    if (await settingValue(ctx, 'supportAi', true))
      await ctx.scheduler.runAfter(0, internal.support.ai.triage, { ticketId });
    return ticketId;
  },
});

/** Your tickets, most recent first. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query('supportTickets')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(100);
    return Promise.all(
      rows.map(async (ticket) => ({
        ...(await ticketSummary(ctx, ticket)),
        unread: ticket.userUnread,
      })),
    );
  },
});

/** One of your tickets with its thread (internal notes excluded). */
export const mineDetail = query({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const ticket = await ctx.db.get(ticketId);
    if (!ticket || ticket.userId !== user._id) return null;
    return {
      ...(await ticketSummary(ctx, ticket)),
      unread: ticket.userUnread,
      messages: await threadFor(ctx, ticket, false),
    };
  },
});

export const reply = mutation({
  args: { ticketId: v.id('supportTickets'), message: v.string() },
  handler: async (ctx, { ticketId, message }) => {
    const user = await requireUser(ctx);
    if (!user) throw supportError('AUTH_REQUIRED');
    const ticket = await ctx.db.get(ticketId);
    if (!ticket || ticket.userId !== user._id) throw supportError('SUPPORT_TICKET_NOT_FOUND');
    if (ticket.status === 'closed') throw supportError('SUPPORT_TICKET_CLOSED');
    const body = cleanText(message, SUPPORT_LIMITS.messageMax);
    if (!body) throw supportError('SUPPORT_TEXT_INVALID');
    const id = await appendMessage(ctx, ticket, user._id, 'user', body, false);
    await trackUsage(ctx, user._id, 'support.reply');
    return id;
  },
});

export const markRead = mutation({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    const user = await requireUser(ctx);
    const ticket = await ctx.db.get(ticketId);
    if (!user || !ticket || ticket.userId !== user._id || !ticket.userUnread) return null;
    await ctx.db.patch(ticketId, { userUnread: false });
    return null;
  },
});

/** The user closes their own ticket. */
export const closeMine = mutation({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    const user = await requireUser(ctx);
    if (!user) throw supportError('AUTH_REQUIRED');
    const ticket = await ctx.db.get(ticketId);
    if (!ticket || ticket.userId !== user._id) throw supportError('SUPPORT_TICKET_NOT_FOUND');
    if (ticket.status === 'closed') return null;
    const now = Date.now();
    await ctx.db.patch(ticketId, { status: 'closed', closedAt: now, updatedAt: now });
    await appendMessage(ctx, ticket, user._id, 'system', 'Closed by the user.', false);
    return null;
  },
});

// ---------- Staff side ----------

export const inbox = query({
  args: {
    status: v.optional(statusValidator),
    view: v.optional(v.union(v.literal('all'), v.literal('mine'), v.literal('unassigned'))),
    category: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, 'VIEW_TICKETS');
    const base =
      args.view === 'mine'
        ? ctx.db
            .query('supportTickets')
            .withIndex('by_assignee_updatedAt', (q) => q.eq('assigneeId', admin.user._id))
        : args.view === 'unassigned'
          ? ctx.db
              .query('supportTickets')
              .withIndex('by_assignee_updatedAt', (q) => q.eq('assigneeId', undefined))
          : args.status
            ? ctx.db
                .query('supportTickets')
                .withIndex('by_status_updatedAt', (q) => q.eq('status', args.status!))
            : ctx.db.query('supportTickets').withIndex('by_updatedAt');
    const page = await base
      .order('desc')
      .filter((q) => {
        const conditions = [];
        if (args.status && args.view && args.view !== 'all')
          conditions.push(q.eq(q.field('status'), args.status));
        if (args.category) conditions.push(q.eq(q.field('category'), args.category));
        if (args.priority) conditions.push(q.eq(q.field('priority'), args.priority));
        return conditions.length ? q.and(...conditions) : true;
      })
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (ticket) => ({
          ...(await ticketSummary(ctx, ticket)),
          user: await userCard(ctx, ticket.userId),
          assignee: ticket.assigneeId ? await userCard(ctx, ticket.assigneeId) : null,
          aiCategory: ticket.aiCategory ?? null,
          aiPriority: ticket.aiPriority ?? null,
          duplicateOf: ticket.duplicateOf ?? null,
        })),
      ),
    };
  },
});

export const inboxCounts = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdminPermission(ctx, 'VIEW_TICKETS');
    const counts: Record<TicketStatus, number> = { open: 0, pending: 0, resolved: 0, closed: 0 };
    for (const status of ['open', 'pending'] as const)
      counts[status] = (
        await ctx.db
          .query('supportTickets')
          .withIndex('by_status_updatedAt', (q) => q.eq('status', status))
          .collect()
      ).length;
    const mine = await ctx.db
      .query('supportTickets')
      .withIndex('by_assignee_updatedAt', (q) => q.eq('assigneeId', admin.user._id))
      .collect();
    return {
      ...counts,
      mine: mine.filter((ticket) => ticket.status === 'open' || ticket.status === 'pending').length,
    };
  },
});

export const staffDetail = query({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    const admin = await requireAdminPermission(ctx, 'VIEW_TICKETS');
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) return null;
    const history = await ctx.db
      .query('supportTickets')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', ticket.userId))
      .order('desc')
      .take(10);
    const duplicate = ticket.duplicateOf ? await ctx.db.get(ticket.duplicateOf) : null;
    return {
      ...(await ticketSummary(ctx, ticket)),
      user: await userCard(ctx, ticket.userId),
      assignee: ticket.assigneeId ? await userCard(ctx, ticket.assigneeId) : null,
      ai: {
        category: ticket.aiCategory ?? null,
        priority: ticket.aiPriority ?? null,
        summary: ticket.aiSummary
          ? await decryptOrPlaceholder(ticket.aiSummary, ticketContext(ticket))
          : null,
        triagedAt: ticket.aiTriagedAt ?? null,
        duplicateOf: duplicate ? { id: duplicate._id, number: duplicate.number } : null,
      },
      messages: await threadFor(ctx, ticket, true),
      otherTickets: await Promise.all(
        history
          .filter((other) => other._id !== ticket._id)
          .map((other) => ticketSummary(ctx, other)),
      ),
      canManage: admin.permissions.has('MANAGE_TICKETS'),
    };
  },
});

export const staffReply = mutation({
  args: {
    ticketId: v.id('supportTickets'),
    message: v.string(),
    internal: v.boolean(),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_TICKETS');
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw adminError('SUPPORT_TICKET_NOT_FOUND');
    const body = cleanText(args.message, SUPPORT_LIMITS.messageMax);
    if (!body) throw adminError('SUPPORT_TEXT_INVALID');
    const id = await appendMessage(ctx, ticket, admin.user._id, 'staff', body, args.internal);
    // Replying claims an unassigned ticket.
    const patch: Partial<Doc<'supportTickets'>> = {};
    if (!ticket.assigneeId && !args.internal) patch.assigneeId = admin.user._id;
    if (args.status) {
      patch.status = args.status;
      if (args.status === 'closed') patch.closedAt = Date.now();
    }
    if (Object.keys(patch).length) await ctx.db.patch(ticket._id, patch);
    if (!args.internal)
      await createNotification(
        ctx,
        ticket.userId,
        `support:reply:${id}`,
        'security',
        'supportTicket',
        String(ticket._id),
        `Support replied to ticket #${ticket.number}`,
        'The Finapp team replied to your support ticket. Open it to read and respond.',
      );
    await logAdminAction(
      ctx,
      admin.user._id,
      args.internal ? 'ticket.note' : 'ticket.reply',
      'ticket',
      String(ticket._id),
      `#${ticket.number}${args.status ? ` → ${args.status}` : ''}`,
    );
    return id;
  },
});

export const update = mutation({
  args: {
    ticketId: v.id('supportTickets'),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    category: v.optional(v.string()),
    assigneeUsername: v.optional(v.union(v.string(), v.null())),
    claim: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_TICKETS');
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw adminError('SUPPORT_TICKET_NOT_FOUND');
    const patch: Partial<Doc<'supportTickets'>> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.status && args.status !== ticket.status) {
      patch.status = args.status;
      patch.closedAt = args.status === 'closed' ? Date.now() : undefined;
      changes.push(`status=${args.status}`);
    }
    if (args.priority && args.priority !== ticket.priority) {
      patch.priority = args.priority;
      changes.push(`priority=${args.priority}`);
    }
    if (args.category && args.category !== ticket.category) {
      if (!isTicketCategory(args.category)) throw adminError('SUPPORT_CATEGORY_INVALID');
      patch.category = args.category;
      changes.push(`category=${args.category}`);
    }
    if (args.claim) {
      patch.assigneeId = admin.user._id;
      changes.push('claimed');
    } else if (args.assigneeUsername === null) {
      patch.assigneeId = undefined;
      changes.push('unassigned');
    } else if (args.assigneeUsername) {
      const username = args.assigneeUsername.replace(/^@+/, '').trim().toLowerCase();
      const user = await ctx.db
        .query('users')
        .withIndex('by_username', (q) => q.eq('username', username))
        .unique();
      if (!user) throw adminError('ADMIN_USER_NOT_FOUND');
      // Only staff who can see tickets can be assigned.
      const member = await memberFor(ctx, user._id);
      if (!member) throw adminError('SUPPORT_ASSIGNEE_NOT_STAFF');
      patch.assigneeId = user._id;
      changes.push(`assigned=@${username}`);
    }
    await ctx.db.patch(ticket._id, patch);
    if (changes.length)
      await logAdminAction(
        ctx,
        admin.user._id,
        'ticket.update',
        'ticket',
        String(ticket._id),
        `#${ticket.number} ${changes.join(' ')}`,
      );
    return null;
  },
});

// ---------- Canned replies ----------

export const cannedReplies = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'VIEW_TICKETS');
    const rows = await ctx.db
      .query('cannedReplies')
      .withIndex('by_updatedAt')
      .order('desc')
      .take(200);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      body: row.body,
      updatedAt: row.updatedAt,
    }));
  },
});

export const saveCannedReply = mutation({
  args: { id: v.optional(v.id('cannedReplies')), title: v.string(), body: v.string() },
  handler: async (ctx, { id, title, body }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_TICKETS');
    const cleanTitle = cleanText(title, 80);
    const cleanBody = cleanText(body, SUPPORT_LIMITS.messageMax);
    if (!cleanTitle || !cleanBody) throw adminError('SUPPORT_TEXT_INVALID');
    const now = Date.now();
    if (id) {
      if (!(await ctx.db.get(id))) throw adminError('ADMIN_NOT_FOUND');
      await ctx.db.patch(id, { title: cleanTitle, body: cleanBody, updatedAt: now });
      await logAdminAction(ctx, admin.user._id, 'canned.update', 'cannedReply', String(id));
      return id;
    }
    const created = await ctx.db.insert('cannedReplies', {
      title: cleanTitle,
      body: cleanBody,
      createdBy: admin.user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAdminAction(ctx, admin.user._id, 'canned.create', 'cannedReply', String(created));
    return created;
  },
});

export const deleteCannedReply = mutation({
  args: { id: v.id('cannedReplies') },
  handler: async (ctx, { id }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_TICKETS');
    if (!(await ctx.db.get(id))) return null;
    await ctx.db.delete(id);
    await logAdminAction(ctx, admin.user._id, 'canned.delete', 'cannedReply', String(id));
    return null;
  },
});
