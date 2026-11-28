/**
 * AI for support tickets, on the app's Gemini configuration (convex/ai/gemini.ts):
 * - triage (on create): category, priority, a short summary and a possible duplicate;
 * - summarize (staff): a fresh summary of the whole thread;
 * - suggestReply (staff): a draft reply for staff to edit.
 *
 * The model only ever sees what the user wrote to support (subject and thread, without internal
 * notes) plus other tickets' subjects for duplicate detection. Never finance data.
 */
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from '../_generated/server';
import { generateStructured, generateText, isGeminiConfigured } from '../ai/gemini';
import type { GeminiSchema } from '../ai/gemini';
import { cryptoContext, decryptOrPlaceholder, encryptText } from '../admin/crypto';
import { requireAdminPermission } from '../admin/guard';
import { trackUsage } from '../admin/usage';
import { isTicketCategory, isTicketPriority, TICKET_CATEGORIES, TICKET_PRIORITIES } from './domain';

const MAX_THREAD_CHARS = 12_000;

type TicketForAi = {
  ticketId: Id<'supportTickets'>;
  userId: Id<'users'>;
  number: number;
  category: string;
  subject: string;
  thread: string;
  candidates: { number: number; id: Id<'supportTickets'>; subject: string; category: string }[];
};

/** The ticket text for the model: subject plus non-internal messages, newest last. */
export const ticketForAi = internalQuery({
  args: { ticketId: v.id('supportTickets'), withCandidates: v.boolean() },
  handler: async (ctx, { ticketId, withCandidates }): Promise<TicketForAi | null> => {
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) return null;
    const context = cryptoContext.ticket(String(ticket.userId));
    const messages = await ctx.db
      .query('supportMessages')
      .withIndex('by_ticket_createdAt', (q) => q.eq('ticketId', ticketId))
      .collect();
    const lines: string[] = [];
    for (const message of messages) {
      if (message.internal || message.author === 'system') continue;
      lines.push(
        `${message.author === 'user' ? 'User' : 'Support'}: ${await decryptOrPlaceholder(message.body, context)}`,
      );
    }
    let thread = lines.join('\n\n');
    if (thread.length > MAX_THREAD_CHARS) thread = thread.slice(-MAX_THREAD_CHARS);
    const candidates: TicketForAi['candidates'] = [];
    if (withCandidates) {
      for (const status of ['open', 'pending'] as const) {
        const rows = await ctx.db
          .query('supportTickets')
          .withIndex('by_status_updatedAt', (q) => q.eq('status', status))
          .order('desc')
          .take(25);
        for (const row of rows) {
          if (row._id === ticketId) continue;
          candidates.push({
            id: row._id,
            number: row.number,
            category: row.category,
            subject: await decryptOrPlaceholder(
              row.subject,
              cryptoContext.ticket(String(row.userId)),
            ),
          });
        }
      }
    }
    return {
      ticketId,
      userId: ticket.userId,
      number: ticket.number,
      category: ticket.category,
      subject: await decryptOrPlaceholder(ticket.subject, context),
      thread,
      candidates,
    };
  },
});

export const saveTriage = internalMutation({
  args: {
    ticketId: v.id('supportTickets'),
    category: v.optional(v.string()),
    priority: v.optional(v.string()),
    summary: v.optional(v.string()),
    duplicateOf: v.optional(v.id('supportTickets')),
    applyPriority: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;
    const patch: Record<string, unknown> = { aiTriagedAt: Date.now() };
    if (args.category && isTicketCategory(args.category)) patch.aiCategory = args.category;
    if (args.priority && isTicketPriority(args.priority)) {
      patch.aiPriority = args.priority;
      // Triage raises the working priority (staff can still change it); it never lowers it.
      const rank = (value: string) => (TICKET_PRIORITIES as readonly string[]).indexOf(value);
      if (args.applyPriority && rank(args.priority) > rank(ticket.priority))
        patch.priority = args.priority;
    }
    if (args.summary)
      patch.aiSummary = await encryptText(
        args.summary.slice(0, 1000),
        cryptoContext.ticket(String(ticket.userId)),
      );
    if (args.duplicateOf && args.duplicateOf !== ticket._id) patch.duplicateOf = args.duplicateOf;
    await ctx.db.patch(ticket._id, patch);
    await trackUsage(ctx, ticket.userId, 'ai.support');
    return null;
  },
});

const SYSTEM = `You help the Finapp support team triage tickets. Finapp is a personal finance and
shared-expenses app. Work only from the ticket text you are given. Never ask for or repeat
passwords, card numbers or account numbers. Reply in the language of the ticket.`;

const triageSchema: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: Object.keys(TICKET_CATEGORIES) },
    priority: { type: 'STRING', enum: [...TICKET_PRIORITIES] },
    summary: { type: 'STRING' },
    duplicateOfNumber: { type: 'INTEGER', nullable: true },
  },
  required: ['category', 'priority', 'summary'],
};

/** Runs after a ticket is created. Best effort: failures leave the ticket untriaged. */
export const triage = internalAction({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    if (!isGeminiConfigured()) return null;
    const ticket = await ctx.runQuery(internal.support.ai.ticketForAi, {
      ticketId,
      withCandidates: true,
    });
    if (!ticket) return null;
    const candidates = ticket.candidates
      .map((row) => `#${row.number} [${row.category}] ${row.subject}`)
      .join('\n');
    try {
      const result = await generateStructured<{
        category: string;
        priority: string;
        summary: string;
        duplicateOfNumber?: number | null;
      }>({
        role: 'utility',
        maxOutputTokens: 512,
        systemInstruction: SYSTEM,
        responseSchema: triageSchema,
        parts: [
          {
            text: `Categories: ${Object.entries(TICKET_CATEGORIES)
              .map(([key, label]) => `${key} (${label})`)
              .join(', ')}.
Priorities: low, normal, high (blocked from using the app or data looks wrong), urgent (security
issue, account takeover, data loss).
Give the best category and priority, a one or two sentence summary for staff, and the number of
an existing ticket that reports the same problem, if one clearly does (otherwise null).

Existing open tickets:
${candidates || '(none)'}

New ticket #${ticket.number} [${ticket.category}]
Subject: ${ticket.subject}
${ticket.thread}`,
          },
        ],
      });
      const duplicate = ticket.candidates.find(
        (row) => row.number === result.data.duplicateOfNumber,
      );
      await ctx.runMutation(internal.support.ai.saveTriage, {
        ticketId,
        category: result.data.category,
        priority: result.data.priority,
        summary: result.data.summary,
        applyPriority: true,
        ...(duplicate ? { duplicateOf: duplicate.id } : {}),
      });
    } catch {
      // Untriaged tickets are still in the inbox; staff can run triage again.
    }
    return null;
  },
});

/** Permission check for the staff actions (runs with the caller's identity). */
export const assertStaff = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'MANAGE_TICKETS');
    return null;
  },
});

async function staffTicket(ctx: ActionCtx, ticketId: Id<'supportTickets'>) {
  await ctx.runQuery(internal.support.ai.assertStaff, {});
  if (!isGeminiConfigured()) throw new Error('AI_NOT_CONFIGURED');
  const ticket = await ctx.runQuery(internal.support.ai.ticketForAi, {
    ticketId,
    withCandidates: false,
  });
  if (!ticket) throw new Error('SUPPORT_TICKET_NOT_FOUND');
  return ticket;
}

/** Re-runs triage on demand (staff). */
export const retriage = action({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }) => {
    await ctx.runQuery(internal.support.ai.assertStaff, {});
    await ctx.runAction(internal.support.ai.triage, { ticketId });
    return null;
  },
});

export const summarize = action({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, { ticketId }): Promise<string> => {
    const ticket = await staffTicket(ctx, ticketId);
    const result = await generateText({
      role: 'utility',
      maxOutputTokens: 400,
      systemInstruction: SYSTEM,
      parts: [
        {
          text: `Summarize this support conversation for staff in at most 4 short bullet points:
the problem, what was tried, what the user is waiting for.

Subject: ${ticket.subject}
${ticket.thread}`,
        },
      ],
    });
    const summary = result.text.trim();
    await ctx.runMutation(internal.support.ai.saveTriage, { ticketId, summary });
    return summary;
  },
});

export const suggestReply = action({
  args: { ticketId: v.id('supportTickets'), tone: v.optional(v.string()) },
  handler: async (ctx, { ticketId, tone }): Promise<string> => {
    const ticket = await staffTicket(ctx, ticketId);
    const result = await generateText({
      role: 'utility',
      maxOutputTokens: 600,
      systemInstruction: SYSTEM,
      parts: [
        {
          text: `Draft the next reply from the Finapp support team to this user. Be ${
            tone === 'brief' ? 'brief' : 'warm and clear'
          }; ask for missing details if needed; don't promise timelines or refunds. Reply with the
message text only.

Subject: ${ticket.subject}
${ticket.thread}`,
        },
      ],
    });
    await ctx.runMutation(internal.support.ai.countUse, { userId: ticket.userId });
    return result.text.trim();
  },
});

export const countUse = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await trackUsage(ctx, userId, 'ai.support');
    return null;
  },
});
