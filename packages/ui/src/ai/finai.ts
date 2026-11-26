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

/** One tool call the agent made for a reply. */
export type FinaiStep = {
  tool: string;
  label: string;
  stage: FinaiStage;
  status: 'running' | 'done' | 'error';
  startedAt: number;
  durationMs?: number;
};

/** FinAI fields on a reply (assistant message or chat bubble). */
export type FinaiReply = {
  status: FinaiReplyStatus;
  stage?: FinaiStage;
  stageLabel?: string;
  /** Tool calls, in order (shown as a collapsible process list). */
  steps?: readonly FinaiStep[];
  a2ui?: string;
  errorCode?: string;
  actions?: readonly FinaiActionState[];
};

export type FinaiAttachmentKind = 'image' | 'pdf' | 'spreadsheet' | 'text';

/** A file sent with a message. `available` is false once it has expired and been deleted. */
export type FinaiAttachmentView = {
  id: string;
  name: string;
  kind: FinaiAttachmentKind;
  size: number;
  available: boolean;
  /** Image preview (short-lived), while the file exists. */
  url?: string;
  expiresAt?: number;
};

export type FinaiAssistantMessage = FinaiReply & {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  attachments?: readonly FinaiAttachmentView[];
};

// ---------- Attachments ----------

/** File types FinAI reads (for file pickers and checks before uploading). */
export const FINAI_ATTACHMENT_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'pdf',
  'xlsx',
  'csv',
  'tsv',
  'txt',
  'md',
  'json',
] as const;
export const FINAI_ATTACHMENT_ACCEPT = FINAI_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(
  ',',
);
export const FINAI_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const FINAI_ATTACHMENTS_PER_MESSAGE = 5;

/** An upload waiting in the composer. */
export type FinaiComposerAttachment = {
  /** Local key (stable from pick to send). */
  key: string;
  name: string;
  size: number;
  kind: FinaiAttachmentKind;
  status: 'uploading' | 'ready' | 'error';
  /** Set once registered. */
  id?: string;
  error?: string;
  /** Local preview for images (object URL / file URI). */
  previewUrl?: string;
};

/** The kind for a file name, or null when FinAI can't read it. */
export function finaiAttachmentKind(name: string): FinaiAttachmentKind | null {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['xlsx', 'csv', 'tsv'].includes(ext)) return 'spreadsheet';
  if (['txt', 'md', 'json'].includes(ext)) return 'text';
  return null;
}

/** Why a file can't be attached (checked before uploading), or null if it can. */
export function finaiAttachmentProblem(name: string, size: number): string | null {
  if (/\.xls$/i.test(name)) return 'Save old .xls files as .xlsx or .csv first.';
  if (!finaiAttachmentKind(name)) return 'FinAI reads images, PDFs, spreadsheets and text files.';
  if (size > FINAI_ATTACHMENT_MAX_BYTES) return 'Files can be up to 10 MB.';
  if (size <= 0) return 'This file is empty.';
  return null;
}

const ATTACHMENT_ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: 'Files can be up to 10 MB.',
  FILE_EMPTY: 'This file is empty.',
  UNSUPPORTED_FILE: 'FinAI reads images, PDFs, spreadsheets and text files.',
  ATTACHMENTS_DISABLED: 'Attachments are turned off in FinAI settings.',
  TOO_MANY_ATTACHMENTS: `Attach up to ${FINAI_ATTACHMENTS_PER_MESSAGE} files per message.`,
  ATTACHMENT_NOT_FOUND: 'That file is no longer available. Attach it again.',
};

export function finaiAttachmentError(code: string | undefined): string {
  return (code && ATTACHMENT_ERRORS[code]) || 'Couldn’t upload this file. Try again.';
}

/** "820 KB", "4.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

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
  AI_DISABLED: 'FinAI is turned off. Turn it on in Settings → AI → FinAI.',
  AI_KEY_INVALID: 'Your API key was rejected. Check it in Settings → AI → API keys.',
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
  'Show my category limits',
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

/** "4.2s" / "850ms" for a step's duration. */
export function formatStepDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The collapsed header of a reply's process list: what is running now, or a summary once
 * done ("Used 3 tools · 2.4s").
 */
export function stepsSummary(steps: readonly FinaiStep[], busy: boolean): string {
  const running = steps.findLast((step) => step.status === 'running');
  if (busy && running) return `${running.label}…`;
  const total = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const failed = steps.filter((step) => step.status === 'error').length;
  const used = `Used ${steps.length} ${steps.length === 1 ? 'tool' : 'tools'}`;
  return [used, failed ? `${failed} failed` : '', total ? formatStepDuration(total) : '']
    .filter(Boolean)
    .join(' · ');
}

// ---------- Background replies ----------

let viewingConversation: string | null = null;

/** Records which FinAI chat is on screen right now (null when none), so its replies don't toast. */
export function setFinaiViewing(conversationId: string | null) {
  viewingConversation = conversationId;
}

/** The FinAI chat currently on screen, if any. */
export function finaiViewing(): string | null {
  return viewingConversation;
}

export type FinaiLatestReply = {
  conversationId: string;
  replyId: string;
  title: string;
  preview: string;
  failed: boolean;
  at: number;
};

/**
 * Whether a finished reply deserves a "FinAI replied" toast: it's newer than anything already
 * seen or toasted, and its chat isn't the one on screen.
 */
export function shouldToastReply(
  latest: FinaiLatestReply | null | undefined,
  seenAt: number,
  viewing: string | null,
): boolean {
  return !!latest && latest.at > seenAt && latest.conversationId !== viewing;
}
