/**
 * Platform-neutral FinAI client model: message and card types, a strict parser for the A2UI
 * v0.9 messages FinAI replies carry (the native renderer draws the parsed tree; the web feeds
 * the same messages to `@a2ui/react`), error copy, Thinking Orb states and `@finai` mention
 * autocomplete helpers.
 */
import type { ThinkingOrbState } from './orbModel';

export const FINAI_NAME = 'FinAI';
export const FINAI_HANDLE = 'finai';
export const FINAI_CATALOG_ID = 'https://fin.neeraj.fyi/a2ui/finapp/v1/catalog.json';
export const FINAI_EVENTS = { confirm: 'finai.confirm', cancel: 'finai.cancel' } as const;

export type FinaiReplyStatus = 'pending' | 'streaming' | 'done' | 'error';
export type FinaiStage = 'reasoning' | 'working' | 'searching';
export type FinaiActionStatus = 'pending' | 'running' | 'done' | 'cancelled' | 'failed' | 'expired';

export type FinaiActionState = {
  id: string;
  title: string;
  status: FinaiActionStatus;
  errorCode?: string;
  canDecide: boolean;
  /** False when only a retry is safe (an interrupted confirmation). */
  canCancel?: boolean;
};

/** FinAI fields on a reply (assistant message or chat bubble). */
export type FinaiReply = {
  status: FinaiReplyStatus;
  stage?: FinaiStage;
  stageLabel?: string;
  a2ui?: string;
  errorCode?: string;
  actions?: readonly FinaiActionState[];
};

export type FinaiAssistantMessage = FinaiReply & {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
};

// ---------- A2UI catalog (mirror of convex/ai/a2ui.ts) ----------

export type FinaiTone = 'positive' | 'negative' | 'neutral' | 'accent';
type Base = { id: string };
export type FinaiNode =
  | (Base & {
      component: 'SummaryCard';
      title: string;
      subtitle?: string;
      metrics: { label: string; value: string; tone: FinaiTone }[];
    })
  | (Base & {
      component: 'TransactionList';
      title: string;
      emptyText: string;
      items: { id: string; title: string; subtitle?: string; amount: string; tone: FinaiTone }[];
    })
  | (Base & {
      component: 'BarChart';
      title: string;
      bars: { label: string; value: number; display: string }[];
    })
  | (Base & {
      component: 'ProgressList';
      title: string;
      items: { label: string; progress: number; detail: string; tone: FinaiTone }[];
    })
  | (Base & {
      component: 'BalanceList';
      title: string;
      subtitle?: string;
      members: { name: string; amount: string; tone: FinaiTone }[];
      transfers: { from: string; to: string; amount: string }[];
    })
  | (Base & {
      component: 'ActionCard';
      actionId: string;
      title: string;
      lines: { label: string; value: string }[];
    });

export type FinaiSurface = {
  surfaceId: string;
  /** The raw A2UI messages, for renderers that take the protocol directly. */
  messages: unknown[];
  /** Root children in order. */
  nodes: FinaiNode[];
};

const TONES: readonly FinaiTone[] = ['positive', 'negative', 'neutral', 'accent'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 200) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;
const tone = (value: unknown): FinaiTone =>
  TONES.includes(value as FinaiTone) ? (value as FinaiTone) : 'neutral';
const list = (value: unknown, max: number) =>
  Array.isArray(value) ? value.filter(isRecord).slice(0, max) : [];

function parseNode(raw: Record<string, unknown>): FinaiNode | null {
  const id = text(raw.id, 64);
  const title = text(raw.title) ?? '';
  if (!id) return null;
  switch (raw.component) {
    case 'SummaryCard':
      return {
        id,
        component: 'SummaryCard',
        title,
        ...(text(raw.subtitle) ? { subtitle: text(raw.subtitle) } : {}),
        metrics: list(raw.metrics, 6).map((m) => ({
          label: text(m.label, 40) ?? '',
          value: text(m.value, 40) ?? '',
          tone: tone(m.tone),
        })),
      };
    case 'TransactionList':
      return {
        id,
        component: 'TransactionList',
        title,
        emptyText: text(raw.emptyText) ?? 'Nothing to show.',
        items: list(raw.items, 8).map((item, index) => ({
          id: text(item.id, 64) ?? String(index),
          title: text(item.title, 80) ?? '',
          ...(text(item.subtitle, 80) ? { subtitle: text(item.subtitle, 80) } : {}),
          amount: text(item.amount, 40) ?? '',
          tone: tone(item.tone),
        })),
      };
    case 'BarChart':
      return {
        id,
        component: 'BarChart',
        title,
        bars: list(raw.bars, 8).map((bar) => ({
          label: text(bar.label, 32) ?? '',
          value:
            typeof bar.value === 'number' && Number.isFinite(bar.value)
              ? Math.max(0, bar.value)
              : 0,
          display: text(bar.display, 40) ?? '',
        })),
      };
    case 'ProgressList':
      return {
        id,
        component: 'ProgressList',
        title,
        items: list(raw.items, 8).map((item) => ({
          label: text(item.label, 60) ?? '',
          progress:
            typeof item.progress === 'number' && Number.isFinite(item.progress)
              ? Math.min(1, Math.max(0, item.progress))
              : 0,
          detail: text(item.detail, 60) ?? '',
          tone: tone(item.tone),
        })),
      };
    case 'BalanceList':
      return {
        id,
        component: 'BalanceList',
        title,
        ...(text(raw.subtitle) ? { subtitle: text(raw.subtitle) } : {}),
        members: list(raw.members, 12).map((m) => ({
          name: text(m.name, 60) ?? '',
          amount: text(m.amount, 40) ?? '',
          tone: tone(m.tone),
        })),
        transfers: list(raw.transfers, 12).map((t) => ({
          from: text(t.from, 60) ?? '',
          to: text(t.to, 60) ?? '',
          amount: text(t.amount, 40) ?? '',
        })),
      };
    case 'ActionCard': {
      const actionId = text(raw.actionId, 64);
      if (!actionId) return null;
      return {
        id,
        component: 'ActionCard',
        actionId,
        title,
        lines: list(raw.lines, 8).map((line) => ({
          label: text(line.label, 40) ?? '',
          value: text(line.value, 120) ?? '',
        })),
      };
    }
    default:
      return null;
  }
}

/**
 * Parses a reply's A2UI JSON. Only FinApp-catalog surfaces are accepted, unknown components
 * are dropped, and every string is length-limited: the payload is treated as untrusted.
 */
export function parseFinaiSurface(json: string | undefined | null): FinaiSurface | null {
  if (!json) return null;
  let messages: unknown;
  try {
    messages = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(messages)) return null;
  const create = messages.find(
    (m): m is { createSurface: { surfaceId: string; catalogId: string } } =>
      isRecord(m) && isRecord(m.createSurface),
  );
  if (!create || create.createSurface.catalogId !== FINAI_CATALOG_ID) return null;
  const surfaceId = text(create.createSurface.surfaceId, 128);
  if (!surfaceId) return null;
  const components = messages
    .filter(
      (m): m is { updateComponents: { surfaceId: string; components: unknown[] } } =>
        isRecord(m) && isRecord(m.updateComponents) && m.updateComponents.surfaceId === surfaceId,
    )
    .flatMap((m) =>
      Array.isArray(m.updateComponents.components) ? m.updateComponents.components : [],
    )
    .filter(isRecord);
  const byId = new Map(components.map((c) => [c.id, c]));
  const root = byId.get('root');
  const childIds = root && Array.isArray(root.children) ? root.children.slice(0, 8) : [];
  const nodes = childIds
    .map((childId) => byId.get(childId))
    .filter(isRecord)
    .map(parseNode)
    .filter((node): node is FinaiNode => node !== null);
  return nodes.length ? { surfaceId, messages, nodes } : null;
}

// ---------- Copy and states ----------

const errorCopy: Record<string, string> = {
  AI_NOT_CONFIGURED: 'FinAI isn’t set up on this server yet.',
  AI_RATE_LIMITED: 'You’ve reached today’s FinAI limit. Try again tomorrow.',
  AI_BUSY: 'FinAI is busy right now. Try again in a moment.',
  AI_UNAVAILABLE: 'FinAI is unavailable right now. Try again in a moment.',
  AI_TIMEOUT: 'FinAI took too long to answer. Try again.',
  AI_BLOCKED: 'FinAI can’t help with that request.',
  AI_TRUNCATED: 'The answer was cut short. Try asking again.',
  AI_BAD_RESPONSE: 'FinAI returned something unexpected. Try again.',
  AI_REQUEST_REJECTED: 'FinAI couldn’t process that request.',
  REPLY_IN_PROGRESS: 'FinAI is still answering your last message.',
  INVALID_PROMPT: 'Write a message up to 4,000 characters.',
  NOT_MEMBER: 'FinAI can only read groups everyone here belongs to.',
  NO_ACCOUNT_IN_CURRENCY: 'Add an account in this currency first, then confirm again.',
  ACTION_EXPIRED: 'This card expired. Ask FinAI again.',
  ACTION_ALREADY_DECIDED: 'This card was already handled.',
  NOTHING_OWED: 'Nothing is owed between you right now.',
  INVALID_SPLIT: 'The split no longer adds up. Ask FinAI again.',
};

export function finaiErrorMessage(code: string | undefined): string {
  return (code && errorCopy[code]) || 'Something went wrong. Try again.';
}

export function orbStateFor(reply: Pick<FinaiReply, 'status' | 'stage'>): ThinkingOrbState {
  if (reply.status === 'streaming') return 'working';
  return reply.stage ?? 'reasoning';
}

export const isFinaiBusy = (reply: Pick<FinaiReply, 'status'> | undefined) =>
  !!reply && (reply.status === 'pending' || reply.status === 'streaming');

export const actionStatusLabel: Record<FinaiActionStatus, string> = {
  pending: 'Needs your OK',
  running: 'Working…',
  done: 'Done',
  cancelled: 'Cancelled',
  failed: 'Didn’t go through',
  expired: 'Expired',
};

export const FINAI_SUGGESTIONS = [
  'How much did I spend this month?',
  'Who owes me money?',
  'Show my budgets',
  'Add ₹250 lunch today',
] as const;

// ---------- @finai mention autocomplete ----------

export type MentionOption = { handle: string; label: string; description: string };
export const FINAI_MENTION: MentionOption = {
  handle: FINAI_HANDLE,
  label: FINAI_NAME,
  description: 'Ask about balances, expenses and settling up',
};

/** The `@query` being typed at the caret, if any. */
export function activeMention(
  draft: string,
  caret = draft.length,
): { start: number; query: string } | null {
  const before = draft.slice(0, caret);
  const match = /(^|\s)@([\w]{0,20})$/.exec(before);
  if (!match) return null;
  return { start: before.length - match[2]!.length - 1, query: match[2]!.toLowerCase() };
}

export function mentionMatches(options: readonly MentionOption[], query: string): MentionOption[] {
  return options.filter(
    (option) => option.handle.startsWith(query) || option.label.toLowerCase().startsWith(query),
  );
}

/** Replaces the `@query` at the caret with `@handle `, returning the draft and new caret. */
export function applyMention(
  draft: string,
  option: MentionOption,
  caret = draft.length,
): { draft: string; caret: number } {
  const active = activeMention(draft, caret);
  if (!active) return { draft, caret };
  const insert = `@${option.handle} `;
  const next = draft.slice(0, active.start) + insert + draft.slice(caret).replace(/^\s+/, '');
  return { draft: next, caret: active.start + insert.length };
}

export const mentionsFinai = (value: string) =>
  new RegExp(`(^|[^\\w@])@${FINAI_HANDLE}\\b`, 'i').test(value);

// ---------- Chat mapping (group chats and DMs) ----------

/** The `ai` fields the chat queries return on FinAI replies. */
export type ServerFinaiChatFields = FinaiReply & { isRequester: boolean };

/**
 * Overrides for a chat message that is a FinAI reply: it renders as FinAI (never "mine",
 * whoever asked) with its reply state. Empty for other messages.
 */
export function finaiChatOverrides(ai: ServerFinaiChatFields | undefined) {
  if (!ai) return {};
  return {
    kind: 'ai' as const,
    mine: false,
    senderName: FINAI_NAME,
    senderAvatarUrl: null,
    senderAvatarId: undefined,
    ai,
  };
}

/** "FinAI is typing" while any reply in the thread is in progress. */
export function finaiTypingNames(
  messages: readonly { ai?: Pick<FinaiReply, 'status'> }[],
): string[] {
  return messages.some((message) => isFinaiBusy(message.ai)) ? [FINAI_NAME] : [];
}
