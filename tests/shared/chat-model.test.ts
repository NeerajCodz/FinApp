import { describe, expect, it } from 'vitest';
import {
  buildChatRows,
  CHAT_GROUP_WINDOW_MS,
  firstUnreadMessageId,
  messageAccessibleLabel,
  pinPreview,
  readersOf,
  receiptLabel,
  typingLabel,
  type ChatMessage,
} from '../../packages/ui/src/chat/model';

const day = (offsetDays: number, hour: number, minute = 0) => {
  const date = new Date(2026, 10, 20 + offsetDays, hour, minute);
  return date.getTime();
};
const message = (id: string, createdAt: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  kind: 'text',
  createdAt,
  mine: false,
  senderId: 'alex',
  senderName: 'Alex',
  text: id,
  ...extra,
});

describe('chat rows', () => {
  it('adds day separators and groups consecutive messages by sender and time', () => {
    const now = day(1, 12);
    const rows = buildChatRows(
      [
        message('a', day(0, 9)),
        message('b', day(0, 9, 2)),
        message('c', day(0, 9, 2) + CHAT_GROUP_WINDOW_MS + 1),
        message('d', day(0, 10), { mine: true, senderId: 'me' }),
        message('e', day(1, 8)),
      ],
      { now },
    );
    expect(rows.map((row) => (row.type === 'message' ? row.key : row.type))).toEqual([
      'day',
      'a',
      'b',
      'c',
      'd',
      'day',
      'e',
    ]);
    const flags = Object.fromEntries(
      rows.flatMap((row) =>
        row.type === 'message' ? [[row.key, [row.firstInGroup, row.lastInGroup]]] : [],
      ),
    );
    expect(flags).toEqual({
      a: [true, false],
      b: [false, true],
      c: [true, true],
      d: [true, true],
      e: [true, true],
    });
    expect(rows[0]).toMatchObject({ type: 'day', label: 'Yesterday' });
    expect(rows[5]).toMatchObject({ type: 'day', label: 'Today' });
  });

  it('inserts an unread marker that breaks the group and never groups event cards', () => {
    const rows = buildChatRows(
      [
        message('a', day(0, 9)),
        message('b', day(0, 9, 1)),
        message('x', day(0, 9, 2), { kind: 'event', event: { label: 'Expense', title: 'Cab' } }),
        message('c', day(0, 9, 3)),
      ],
      { firstUnreadId: 'b', now: day(0, 12) },
    );
    expect(rows.map((row) => (row.type === 'message' ? row.key : row.type))).toEqual([
      'day',
      'a',
      'unread',
      'b',
      'x',
      'c',
    ]);
    expect(rows.find((row) => row.type === 'unread')).toMatchObject({ count: 3 });
    const a = rows.find((row) => row.type === 'message' && row.key === 'a');
    expect(a).toMatchObject({ lastInGroup: true });
    const c = rows.find((row) => row.type === 'message' && row.key === 'c');
    expect(c).toMatchObject({ firstInGroup: true });
  });
});

describe('receipts, unread and typing helpers', () => {
  const people = [
    { id: 'alex', name: 'Alex' },
    { id: 'sam', name: 'Sam' },
    { id: 'me', name: 'You' },
  ];

  it('finds the first unread incoming message after the read pointer', () => {
    const messages = [
      message('a', 10),
      message('mine', 20, { mine: true }),
      message('b', 30),
      message('pending', 40, { mine: true, status: 'pending' }),
    ];
    expect(firstUnreadMessageId(messages, 15)).toBe('b');
    expect(firstUnreadMessageId(messages, 30)).toBeUndefined();
    expect(firstUnreadMessageId(messages, undefined)).toBeUndefined();
  });

  it('derives readers from pointers, excluding the sender', () => {
    const pointers = [
      { userId: 'alex', lastReadAt: 50 },
      { userId: 'sam', lastReadAt: 20 },
      { userId: 'me', lastReadAt: 99 },
    ];
    expect(readersOf(30, 'me', pointers, people).map((person) => person.id)).toEqual(['alex']);
    expect(readersOf(10, 'me', pointers, people).map((person) => person.id)).toEqual([
      'alex',
      'sam',
    ]);
  });

  it('labels receipts and typing', () => {
    const mine = message('m', 10, { mine: true, senderId: 'me' });
    expect(receiptLabel({ ...mine, seen: true }, 'direct')).toBe('Seen');
    expect(receiptLabel(mine, 'direct')).toBe('Sent');
    expect(receiptLabel({ ...mine, seenBy: people.slice(0, 2) }, 'group')).toBe('Seen by 2');
    expect(receiptLabel({ ...mine, status: 'pending' }, 'group')).toBe('Sending…');
    expect(receiptLabel({ ...mine, status: 'failed' }, 'direct')).toBe('Not sent');
    expect(
      messageAccessibleLabel({ ...mine, seenBy: people.slice(0, 1), pinned: true }, 'group'),
    ).toMatch(/You, .*: m, pinned, Seen by 1 \(Alex\)$/);
    expect(typingLabel([])).toBe('');
    expect(typingLabel(['Alex'])).toBe('Alex is typing');
    expect(typingLabel(['Alex', 'Sam'])).toBe('Alex and Sam are typing');
    expect(typingLabel(['Alex', 'Sam', 'Kai'])).toBe('Alex and 2 others are typing');
    expect(pinPreview('a  b\nc')).toBe('a b c');
    expect(pinPreview('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});
