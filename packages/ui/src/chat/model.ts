/**
 * Platform-neutral chat model shared by the native and web threads: message shapes, row
 * building (day separators, sender grouping, unread marker) and receipt/typing helpers.
 */

export const CHAT_REACTIONS = ['❤️', '👍', '😂', '😮'] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTIONS)[number];
export const CHAT_TEXT_LIMIT = 4_000;
/** Consecutive messages from one sender within this window share a bubble group. */
export const CHAT_GROUP_WINDOW_MS = 5 * 60_000;
/** Pixels from the newest message that still count as "at the bottom". */
export const CHAT_NEAR_BOTTOM_PX = 120;

export type ChatPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarId?: string;
};

/**
 * `event` is a ledger card (expense or settlement), `system` a centred notice, and `ai` a
 * message from an assistant sender; all render without a reply bubble from the viewer.
 */
export type ChatMessageKind = 'text' | 'image' | 'event' | 'system' | 'ai';
export type ChatDeliveryStatus = 'sent' | 'pending' | 'failed';

export type ChatEvent = {
  label: string;
  title: string;
  amount?: string;
  amountMinor?: bigint;
  currency?: string;
  icon?: string;
  color?: string;
  onPress?: () => void;
};

export type ChatMessage = {
  id: string;
  kind: ChatMessageKind;
  createdAt: number;
  mine: boolean;
  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string | null;
  senderAvatarId?: string;
  text?: string;
  imageUrl?: string | null;
  status?: ChatDeliveryStatus;
  reactions?: readonly { emoji: string; count: number }[];
  myReaction?: string | null;
  pinned?: boolean;
  canPin?: boolean;
  /** Group receipts: who has read this message (excluding the sender). */
  seenBy?: readonly ChatPerson[];
  /** DM receipt: whether the other participant has read this message. */
  seen?: boolean;
  event?: ChatEvent;
};

export type ChatPin = { id: string; text: string; senderName: string };

export type ChatRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'unread'; key: string; count: number }
  | {
      type: 'message';
      key: string;
      message: ChatMessage;
      firstInGroup: boolean;
      lastInGroup: boolean;
    };

const groupable = (message: ChatMessage) => message.kind !== 'event' && message.kind !== 'system';

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayLabel(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const date = new Date(timestamp);
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }),
  });
}

export function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Rows oldest first: a separator at each new day, an "unread" marker before the first unread
 * message, and first/last flags so consecutive messages from one sender render as a group.
 */
export function buildChatRows(
  messages: readonly ChatMessage[],
  options: { firstUnreadId?: string; now?: number } = {},
): ChatRow[] {
  const rows: ChatRow[] = [];
  const now = options.now ?? Date.now();
  const unreadIndex = options.firstUnreadId
    ? messages.findIndex((message) => message.id === options.firstUnreadId)
    : -1;
  const sameGroup = (left?: ChatMessage, right?: ChatMessage) =>
    !!left &&
    !!right &&
    groupable(left) &&
    groupable(right) &&
    left.senderId === right.senderId &&
    left.mine === right.mine &&
    right.createdAt - left.createdAt <= CHAT_GROUP_WINDOW_MS &&
    startOfDay(left.createdAt) === startOfDay(right.createdAt);
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const day = startOfDay(message.createdAt);
    if (!previous || startOfDay(previous.createdAt) !== day)
      rows.push({ type: 'day', key: `day:${day}`, label: dayLabel(message.createdAt, now) });
    const unreadHere = index === unreadIndex;
    if (unreadHere)
      rows.push({ type: 'unread', key: 'unread', count: messages.length - unreadIndex });
    rows.push({
      type: 'message',
      key: message.id,
      message,
      firstInGroup: unreadHere || !sameGroup(previous, message),
      lastInGroup: index + 1 === unreadIndex || !sameGroup(message, next),
    });
  });
  return rows;
}

/** First message from someone else created after the viewer's read pointer. */
export function firstUnreadMessageId(
  messages: readonly ChatMessage[],
  lastReadAt: number | undefined,
): string | undefined {
  if (lastReadAt === undefined) return undefined;
  return messages.find(
    (message) => !message.mine && message.status !== 'pending' && message.createdAt > lastReadAt,
  )?.id;
}

/** Members whose read pointer covers a message, excluding its sender. */
export function readersOf(
  createdAt: number,
  senderId: string | undefined,
  pointers: readonly { userId: string; lastReadAt: number }[],
  people: readonly ChatPerson[],
): ChatPerson[] {
  return pointers
    .filter((pointer) => pointer.userId !== senderId && pointer.lastReadAt >= createdAt)
    .map((pointer) => people.find((person) => person.id === pointer.userId))
    .filter((person): person is ChatPerson => !!person);
}

export function typingLabel(names: readonly string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]} and ${names.length - 1} others are typing`;
}

export function receiptLabel(message: ChatMessage, mode: 'direct' | 'group'): string {
  if (message.status === 'pending') return 'Sending…';
  if (message.status === 'failed') return 'Not sent';
  if (mode === 'direct') return message.seen ? 'Seen' : 'Sent';
  const count = message.seenBy?.length ?? 0;
  return count ? `Seen by ${count}` : 'Sent';
}

export function messageAccessibleLabel(message: ChatMessage, mode: 'direct' | 'group'): string {
  const who = message.mine ? 'You' : (message.senderName ?? 'Someone');
  const body =
    message.kind === 'event'
      ? `${message.event?.label ?? 'Activity'}: ${message.event?.title ?? ''} ${message.event?.amount ?? ''}`
      : message.kind === 'image'
        ? 'sent a photo'
        : (message.text ?? '');
  const receipt =
    message.mine && message.kind !== 'event'
      ? `, ${receiptLabel(message, mode)}${
          mode === 'group' && message.seenBy?.length
            ? ` (${message.seenBy.map((person) => person.name).join(', ')})`
            : ''
        }`
      : '';
  return `${who}, ${timeLabel(message.createdAt)}: ${body.trim()}${message.pinned ? ', pinned' : ''}${receipt}`;
}

/** Plain-text preview for a pin or reply chip. */
export function pinPreview(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
