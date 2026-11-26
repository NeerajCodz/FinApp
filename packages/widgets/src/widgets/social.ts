/** People, direct messages, notifications and trash. */
import { CUR, PEOPLE, daysAgo } from '../sample';
import { defineWidget, type Minor } from '../types';

type Person = {
  id?: string;
  _id?: string;
  username?: string;
  displayName?: string;
  name?: string;
  mutualFriends?: number;
  mutualGroups?: number;
  balanceMinor?: Minor;
  currency?: string;
};
const PEOPLE_LIST: Person[] = PEOPLE.map((name, i) => ({
  id: 'u' + i,
  displayName: name,
  username: name.split(' ')[0]!.toLowerCase() + (i + 1),
  mutualFriends: (i * 3) % 7,
  mutualGroups: i % 3,
}));

/** Linked to `finapp.social.friends.list`. */
export const friends = defineWidget<{ items?: Person[] }>({
  domain: 'people',
  name: 'friends',
  title: 'Friends',
  description: 'Your friends with usernames, shared groups and (when known) who owes whom.',
  invoking: 'Loading your friends…',
  examples: [
    {
      items: PEOPLE_LIST.map((p, i) => ({
        ...p,
        balanceMinor: [120_000, -45_000, 0, 32_000, 0, -8_000][i],
        currency: CUR,
      })),
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('People', 'Friends'),
        k.empty('No friends yet', 'Find people by username and send a friend request.', 'users'),
      );
    return k.page(
      k.header('People', k.plural(items.length, 'friend')),
      k.list(
        items.map((p) => {
          const name = p.displayName || p.name || p.username || 'Finapp user';
          const b = p.balanceMinor === undefined ? null : k.num(p.balanceMinor);
          return k.person({
            name,
            sub: [
              p.username ? '@' + p.username : '',
              p.mutualGroups ? k.plural(p.mutualGroups, 'shared group') : '',
            ]
              .filter(Boolean)
              .join(' · '),
            value:
              b === null
                ? ''
                : b === 0
                  ? 'settled'
                  : (b > 0 ? 'owes you ' : 'you owe ') + k.money(Math.abs(b), p.currency),
            valueTone: b === null ? null : k.toneOf(b),
          });
        }),
      ),
    );
  },
});

/** Linked to `finapp.social.requests.list`. */
type Requests = {
  direction?: 'incoming' | 'outgoing';
  items?: Array<{ id: string; createdAt: number; person: Person }>;
  isDone?: boolean;
};

export const requests = defineWidget<Requests>({
  domain: 'people',
  name: 'requests',
  title: 'Friend requests',
  description: 'Incoming or outgoing friend requests with when they were sent.',
  examples: [
    {
      direction: 'incoming',
      items: PEOPLE_LIST.slice(2, 5).map((p, i) => ({
        id: 'fr' + i,
        createdAt: daysAgo(i * 2),
        person: p,
      })),
      isDone: true,
    },
  ],
  empty: { direction: 'incoming', items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    const title = d.direction === 'outgoing' ? 'Sent requests' : 'Friend requests';
    if (!items.length)
      return k.page(
        k.header('People', title),
        k.empty(
          d.direction === 'outgoing' ? 'No pending sent requests' : 'No friend requests',
          undefined,
          'user',
        ),
      );
    return k.page(
      k.header('People', title, k.pill(String(items.length), 'accent')),
      k.list(
        items.map((r) =>
          k.person({
            name: r.person.displayName || r.person.username || 'Finapp user',
            sub:
              (r.person.username ? '@' + r.person.username + ' · ' : '') +
              (d.direction === 'outgoing' ? 'sent ' : 'received ') +
              k.ago(r.createdAt),
          }),
        ),
      ),
    );
  },
});

/** Linked to `finapp.social.people.search`. */
export const search = defineWidget<{ query?: string; items?: Person[] }>({
  domain: 'people',
  name: 'search',
  title: 'People search',
  description: 'Finapp users matching a username search.',
  examples: [
    { query: 'me', items: PEOPLE_LIST.filter((p) => /m/i.test(p.displayName!)).slice(0, 4) },
  ],
  empty: { query: 'zz', items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Search', d.query ? '@' + d.query : 'People'),
        k.empty('No one found', 'Check the spelling — usernames match from the start.', 'search'),
      );
    return k.page(
      k.header('Search', k.plural(items.length, 'person', 'people')),
      k.list(
        items.map((p) =>
          k.person({
            name: p.displayName || p.name || 'Finapp user',
            sub: p.username ? '@' + p.username : '',
          }),
        ),
      ),
    );
  },
});

type Profile = {
  displayName: string;
  username?: string;
  bio?: string;
  relationship?: 'friends' | 'request_sent' | 'request_received' | 'none';
  joinedAt?: number;
  mutualFriends?: string[];
  sharedGroups?: string[];
  netMinor?: Minor;
  currency?: string;
} | null;

export const profile = defineWidget<Profile>({
  domain: 'people',
  name: 'profile',
  title: 'Person',
  description:
    'Someone’s public profile: username, relationship, mutual friends, shared groups and your net balance.',
  examples: [
    {
      displayName: 'Meera Iyer',
      username: 'meera2',
      bio: 'Product designer · chai over coffee',
      relationship: 'friends',
      joinedAt: Date.UTC(2025, 3, 2),
      mutualFriends: ['Aarav Shah', 'Kabir Rao', 'Diya Menon'],
      sharedGroups: ['Flat 4B', 'Goa trip'],
      netMinor: -128_000,
      currency: CUR,
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.displayName)
      return k.page(
        k.empty(
          'Profile not available',
          'This person may have deleted their account or hidden their profile.',
          'user',
        ),
      );
    const rel: Record<string, string> = {
      friends: 'Friends',
      request_sent: 'Request sent',
      request_received: 'Wants to be friends',
      none: 'Not connected',
    };
    const net = d.netMinor === undefined ? null : k.num(d.netMinor);
    return k.page(
      k.card(
        '<div style="display:flex;gap:14px;align-items:center">' +
          k.avatar(d.displayName, 64) +
          '<div class="grow"><h2>' +
          k.esc(d.displayName) +
          '</h2><div class="sub">' +
          k.esc(
            [
              d.username ? '@' + d.username : '',
              d.joinedAt ? 'joined ' + k.date(d.joinedAt, 'month') : '',
            ]
              .filter(Boolean)
              .join(' · '),
          ) +
          '</div>' +
          (d.bio ? '<p class="note" style="margin-top:6px">' + k.esc(d.bio) + '</p>' : '') +
          '</div>' +
          (d.relationship
            ? k.pill(
                rel[d.relationship] || d.relationship,
                d.relationship === 'friends' ? 'income' : null,
              )
            : '') +
          '</div>',
      ),
      net !== null
        ? k.stats([
            {
              label: net === 0 ? 'All square' : net > 0 ? 'Owes you' : 'You owe',
              value: k.money(Math.abs(net), d.currency),
              tone: k.toneOf(net),
            },
          ])
        : '',
      k.arr(d.mutualFriends).length
        ? k.section(
            'Mutual friends',
            k.card(
              '<div style="display:flex;gap:10px;align-items:center">' +
                k.avatars(d.mutualFriends!) +
                '<span class="sub">' +
                k.esc(
                  d.mutualFriends!.slice(0, 2).join(', ') +
                    (d.mutualFriends!.length > 2
                      ? ' and ' + (d.mutualFriends!.length - 2) + ' more'
                      : ''),
                ) +
                '</span></div>',
            ),
          )
        : '',
      k.arr(d.sharedGroups).length
        ? k.section(
            'Shared groups',
            '<div class="chips">' + d.sharedGroups!.map((g) => k.pill(g)).join('') + '</div>',
          )
        : '',
    );
  },
});

export const suggestions = defineWidget<{ items?: Person[] }>({
  domain: 'people',
  name: 'suggestions',
  title: 'People you may know',
  description: 'Suggested people based on mutual friends and shared groups.',
  examples: [{ items: PEOPLE_LIST.slice(3) }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('People', 'Suggestions'),
        k.empty('No suggestions right now', undefined, 'users'),
      );
    return k.page(
      k.header('People', 'You may know'),
      k.grid(
        items.map((p) =>
          k.card(
            '<div style="display:grid;justify-items:center;gap:6px;text-align:center">' +
              k.avatar(p.displayName || 'User', 48) +
              '<strong>' +
              k.esc(p.displayName || p.username || 'Finapp user') +
              '</strong><span class="sub">' +
              k.esc(
                p.mutualFriends
                  ? k.plural(p.mutualFriends, 'mutual friend')
                  : p.mutualGroups
                    ? k.plural(p.mutualGroups, 'shared group')
                    : p.username
                      ? '@' + p.username
                      : '',
              ) +
              '</span></div>',
          ),
        ),
        150,
      ),
    );
  },
});

type Frequent = {
  currency: string;
  items: Array<{ name: string; count: number; totalMinor: Minor }>;
};

export const frequent = defineWidget<Frequent>({
  domain: 'people',
  name: 'frequent',
  title: 'People you split with most',
  description:
    'The people you share the most expenses with, ranked by count, with the amounts involved.',
  examples: [
    {
      currency: CUR,
      items: PEOPLE.slice(0, 5).map((name, i) => ({
        name,
        count: [42, 31, 18, 9, 4][i]!,
        totalMinor: [8_400_000, 4_120_000, 1_960_000, 720_000, 240_000][i]!,
      })),
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('People', 'Frequent'),
        k.empty('No shared expenses yet', undefined, 'users'),
      );
    return k.page(
      k.header('People', 'Split with most'),
      k.card(
        k.barList({
          items: items.map((p) => ({
            label: p.name,
            value: p.count,
            valueText: k.plural(p.count, 'expense'),
            lead: k.avatar(p.name, 28),
            sub: k.money(p.totalMinor, d.currency) + ' together',
            tone: 1,
          })),
          format: 'number',
          title: 'Shared expenses by person',
        }),
      ),
    );
  },
});

type FriendBalances = { currency: string; items: Array<{ name: string; balanceMinor: Minor }> };

export const friendBalances = defineWidget<FriendBalances>({
  domain: 'people',
  name: 'balances',
  title: 'Balances with friends',
  description:
    'Net balance with each friend across all groups: owed to you on one side, owed by you on the other.',
  examples: [
    {
      currency: CUR,
      items: PEOPLE.map((name, i) => ({
        name,
        balanceMinor: [345_000, -128_000, 62_000, -40_000, 18_000, 0][i]!,
      })),
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .filter((p) => k.num(p.balanceMinor) !== 0)
      .sort((a, b) => k.num(b.balanceMinor) - k.num(a.balanceMinor));
    if (!items.length)
      return k.page(
        k.header('People', 'Balances'),
        k.empty('All square with everyone', undefined, 'check'),
      );
    const owed = k.sum(items.filter((p) => k.num(p.balanceMinor) > 0).map((p) => p.balanceMinor));
    const owe = -k.sum(items.filter((p) => k.num(p.balanceMinor) < 0).map((p) => p.balanceMinor));
    const top = k.max(
      items.map((p) => Math.abs(k.num(p.balanceMinor))),
      1,
    );
    return k.page(
      k.header('People', 'Balances with friends'),
      k.stats([
        { label: 'Owed to you', value: k.money(owed, d.currency), tone: 'income' },
        { label: 'You owe', value: k.money(owe, d.currency), tone: 'expense' },
        {
          label: 'Net',
          value: k.money(owed - owe, d.currency, { sign: true }),
          tone: k.toneOf(owed - owe),
        },
      ]),
      k.card(
        items
          .map((p) => {
            const v = k.num(p.balanceMinor);
            const w = Math.round((Math.abs(v) / top) * 100);
            return (
              '<div class="brow" data-tip="' +
              k.esc(
                p.name +
                  ': ' +
                  (v > 0 ? 'owes you ' : 'you owe ') +
                  k.money(Math.abs(v), d.currency),
              ) +
              '" style="padding:4px 0">' +
              k.avatar(p.name, 28) +
              '<div class="grow" style="display:grid;grid-template-columns:1fr 1fr;align-items:center"><div style="display:flex;justify-content:flex-end;border-right:1px solid var(--line)">' +
              (v < 0
                ? '<i style="display:block;height:10px;width:' +
                  w +
                  '%;background:var(--expense);border-radius:4px 0 0 4px"></i>'
                : '') +
              '</div><div>' +
              (v > 0
                ? '<i style="display:block;height:10px;width:' +
                  w +
                  '%;background:var(--income);border-radius:0 4px 4px 0"></i>'
                : '') +
              '</div></div><div class="val" style="min-width:110px"><span class="title" style="font-weight:550">' +
              k.esc(p.name.split(' ')[0]) +
              '</span><span class="amount ' +
              (v > 0 ? 'pos' : 'neg') +
              '">' +
              k.esc(k.money(v, d.currency, { sign: true })) +
              '</span></div></div>'
            );
          })
          .join('') +
          k.srTable(
            'Balances with friends',
            ['Person', 'Balance'],
            items.map((p) => [p.name, k.money(p.balanceMinor, d.currency, { sign: true })]),
          ),
      ),
    );
  },
});

// ---------- Direct messages ----------

/** Linked to `finapp.social.direct_messages.conversations.list`. */
type Conversations = {
  items?: Array<{
    id: string;
    updatedAt: number;
    person: Person;
    lastMessage?: string;
    unread?: number;
    pinned?: boolean;
  }>;
  isDone?: boolean;
};

export const conversations = defineWidget<Conversations>({
  domain: 'chats',
  name: 'conversations',
  title: 'Conversations',
  description: 'Your direct conversations, most recent first, with last message and unread count.',
  invoking: 'Loading conversations…',
  examples: [
    {
      items: PEOPLE_LIST.slice(0, 5).map((p, i) => ({
        id: 'c' + i,
        updatedAt: daysAgo(i, 20 - i),
        person: p,
        lastMessage: [
          'Sent ₹1,200 for the cab 👍',
          'See you at 7?',
          'Can you add the dinner bill?',
          'haha yes',
          'Thanks!',
        ][i],
        unread: [2, 0, 1, 0, 0][i],
        pinned: i === 0,
      })),
      isDone: true,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .slice()
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    if (!items.length)
      return k.page(
        k.header('Messages', 'Conversations'),
        k.empty('No conversations yet', 'Start a chat with a friend.', 'chat'),
      );
    return k.page(
      k.header('Messages', k.plural(items.length, 'conversation')),
      k.list(
        items.map((c) =>
          k.row({
            lead: k.avatar(c.person.displayName || 'User'),
            title: c.person.displayName || c.person.username || 'Finapp user',
            badge: c.pinned ? k.icon('pin', 12) : '',
            sub: c.lastMessage || (c.person.username ? '@' + c.person.username : ''),
            value: c.unread ? String(c.unread) : '',
            valueTone: 'accent',
            valueSub: k.ago(c.updatedAt),
          }),
        ),
      ),
    );
  },
});

/** Linked to `finapp.social.direct_messages.list`. */
type Thread = {
  withName?: string;
  meName?: string;
  items?: Array<{
    id: string;
    kind?: string;
    text?: string;
    createdAt: number;
    senderName: string;
  }>;
  isDone?: boolean;
};

export const thread = defineWidget<Thread>({
  domain: 'chats',
  name: 'thread',
  title: 'Messages',
  description: 'A direct message thread, oldest to newest, with payment events shown inline.',
  examples: [
    {
      withName: 'Aarav Shah',
      meName: 'You',
      items: [
        {
          id: 'd5',
          kind: 'text',
          text: 'Got it, thanks!',
          createdAt: daysAgo(0, 12),
          senderName: 'You',
        },
        {
          id: 'd4',
          kind: 'payment',
          text: 'Aarav paid you ₹1,200',
          createdAt: daysAgo(0, 11),
          senderName: 'Aarav Shah',
        },
        {
          id: 'd3',
          kind: 'text',
          text: 'Sending for the cab now',
          createdAt: daysAgo(0, 11),
          senderName: 'Aarav Shah',
        },
        {
          id: 'd2',
          kind: 'text',
          text: 'It was ₹2,400, split two ways',
          createdAt: daysAgo(1, 22),
          senderName: 'You',
        },
        {
          id: 'd1',
          kind: 'text',
          text: 'How much was the airport cab?',
          createdAt: daysAgo(1, 21),
          senderName: 'Aarav Shah',
        },
      ],
      isDone: true,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items).slice().reverse();
    if (!items.length)
      return k.page(
        k.header('Messages', d.withName || 'Conversation'),
        k.empty('No messages in this window', 'Try an earlier date range.', 'chat'),
      );
    const me = d.meName || 'You';
    return k.page(
      k.header('Messages', d.withName || 'Conversation'),
      '<div class="thread">' +
        items
          .map((m) =>
            m.kind && m.kind !== 'text'
              ? '<p class="note" style="text-align:center">' +
                k.icon('swap', 12) +
                ' ' +
                k.esc(k.str(m.text, m.kind)) +
                '</p>'
              : k.bubble({
                  text: k.str(m.text),
                  from: m.senderName,
                  mine: m.senderName === me,
                  time: k.date(m.createdAt, 'time'),
                }),
          )
          .join('') +
        '</div>',
    );
  },
});

type DmUnread = { items: Array<{ name: string; count: number; lastAt: number }> };

export const dmUnread = defineWidget<DmUnread>({
  domain: 'chats',
  name: 'unread',
  title: 'Unread messages',
  description: 'Who has messaged you that you have not read yet.',
  examples: [
    {
      items: [
        { name: 'Aarav Shah', count: 2, lastAt: daysAgo(0, 11) },
        { name: 'Kabir Rao', count: 1, lastAt: daysAgo(1) },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items).filter((i) => i.count > 0);
    if (!items.length)
      return k.page(k.header('Messages', 'Unread'), k.empty('All caught up', undefined, 'check'));
    return k.page(
      k.header('Messages', 'Unread', k.pill(String(k.sum(items.map((i) => i.count))), 'accent')),
      k.list(
        items.map((i) =>
          k.person({
            name: i.name,
            sub: k.ago(i.lastAt),
            value: String(i.count),
            valueTone: 'accent',
          }),
        ),
      ),
    );
  },
});

type DmPinned = {
  withName: string;
  items: Array<{ text: string; senderName: string; createdAt: number }>;
};

export const dmPinned = defineWidget<DmPinned>({
  domain: 'chats',
  name: 'pinned',
  title: 'Pinned in conversation',
  description: 'Messages pinned in a direct conversation.',
  examples: [
    {
      withName: 'Meera Iyer',
      items: [
        { text: 'My UPI: meera@okhdfc', senderName: 'Meera Iyer', createdAt: daysAgo(30) },
        { text: 'Flight PNR: X7K2QP', senderName: 'You', createdAt: daysAgo(9) },
      ],
    },
  ],
  empty: { withName: 'Friend', items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(k.header('Pinned', d.withName), k.empty('Nothing pinned', undefined, 'pin'));
    return k.page(
      k.header('Pinned', d.withName),
      k.list(
        items.map((m) =>
          k.row({
            lead: k.tile(k.icon('pin', 16), 'warn'),
            title: m.text,
            sub: m.senderName + ' · ' + k.date(m.createdAt, 'day'),
          }),
        ),
      ),
    );
  },
});

type Requests2 = {
  currency: string;
  items: Array<{
    from: string;
    to: string;
    amountMinor: Minor;
    note?: string;
    createdAt: number;
    status: 'pending' | 'paid' | 'declined';
  }>;
};

export const paymentRequests = defineWidget<Requests2>({
  domain: 'chats',
  name: 'paymentRequests',
  title: 'Payment requests',
  description: 'Money requested in chats — by you and from you — with status.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          from: 'You',
          to: 'Kabir Rao',
          amountMinor: 64_000,
          note: 'Movie tickets',
          createdAt: daysAgo(2),
          status: 'pending',
        },
        {
          from: 'Meera Iyer',
          to: 'You',
          amountMinor: 80_000,
          note: 'Electricity',
          createdAt: daysAgo(3),
          status: 'pending',
        },
        {
          from: 'You',
          to: 'Aarav Shah',
          amountMinor: 120_000,
          note: 'Cab',
          createdAt: daysAgo(1),
          status: 'paid',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Messages', 'Payment requests'),
        k.empty('No payment requests', undefined, 'swap'),
      );
    return k.page(
      k.header('Messages', 'Payment requests'),
      k.list(
        items.map((r) =>
          k.row({
            lead: k.avatar(r.from === 'You' ? r.to : r.from),
            title: r.from === 'You' ? 'You asked ' + r.to : r.from + ' asked you',
            sub: [r.note, k.ago(r.createdAt)].filter(Boolean).join(' · '),
            badge: k.pill(
              r.status,
              r.status === 'paid' ? 'income' : r.status === 'declined' ? 'expense' : 'warn',
            ),
            value: k.money(r.amountMinor, d.currency),
            valueTone: r.from === 'You' ? 'income' : 'expense',
          }),
        ),
      ),
    );
  },
});

// ---------- Notifications ----------

/** Linked to `finapp.personal.notifications.list`. */
type Notifs = {
  items?: Array<{
    id: string;
    type?: string;
    title: string;
    body?: string;
    entityType?: string;
    createdAt: number;
    readAt?: number | null;
  }>;
  isDone?: boolean;
};

export const notifications = defineWidget<Notifs>({
  domain: 'notifications',
  name: 'list',
  title: 'Notifications',
  description: 'Your notifications, newest first, with unread ones highlighted.',
  invoking: 'Loading notifications…',
  examples: [
    {
      items: [
        {
          id: 'n1',
          type: 'settlement',
          title: 'Aarav paid you ₹2,250',
          body: 'Goa trip',
          createdAt: daysAgo(0, 11),
        },
        {
          id: 'n2',
          type: 'expense',
          title: 'Meera added Scooter rental',
          body: 'Goa trip · your share ₹600',
          createdAt: daysAgo(1, 18),
        },
        {
          id: 'n3',
          type: 'limit',
          title: 'Shopping is over its limit',
          body: '₹14,200 of ₹12,000',
          createdAt: daysAgo(2),
          readAt: daysAgo(2),
        },
        {
          id: 'n4',
          type: 'friend',
          title: 'Diya Menon accepted your request',
          createdAt: daysAgo(4),
          readAt: daysAgo(3),
        },
        {
          id: 'n5',
          type: 'reminder',
          title: 'Rent is due in 3 days',
          body: '₹28,000 from HDFC Savings',
          createdAt: daysAgo(5),
          readAt: daysAgo(5),
        },
      ],
      isDone: true,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Notifications', 'Inbox'),
        k.empty('You are all caught up', 'New activity will appear here.', 'bell'),
      );
    const unread = items.filter((n) => !n.readAt).length;
    const icons: Record<string, string> = {
      settlement: 'swap',
      expense: 'receipt',
      limit: 'alert',
      friend: 'user',
      reminder: 'calendar',
      goal: 'target',
      security: 'shield',
      message: 'chat',
    };
    return k.page(
      k.header(
        'Notifications',
        unread ? unread + ' unread' : 'All read',
        unread ? k.pill(String(unread), 'accent') : '',
      ),
      k.list(
        items.map((n) =>
          k.row({
            lead: k.tile(
              k.icon(icons[n.type || ''] || 'bell', 16),
              n.readAt ? 'neutral' : n.type === 'limit' ? 'warn' : 'accent',
            ),
            title: n.title,
            sub: [n.body, k.ago(n.createdAt)].filter(Boolean).join(' · '),
            badge: n.readAt ? '' : '<span class="pill acc" style="padding:0 6px">new</span>',
            muted: !!n.readAt,
          }),
        ),
      ),
    );
  },
});

type NotifSummary = {
  period: string;
  byType: Array<{ type: string; count: number }>;
  unread: number;
};

export const notificationSummary = defineWidget<NotifSummary>({
  domain: 'notifications',
  name: 'summary',
  title: 'Notification summary',
  description: 'How many notifications you got by type this week, and how many are unread.',
  examples: [
    {
      period: 'This week',
      unread: 4,
      byType: [
        { type: 'Group expenses', count: 14 },
        { type: 'Settlements', count: 6 },
        { type: 'Reminders', count: 5 },
        { type: 'Limits', count: 3 },
        { type: 'Friends', count: 2 },
        { type: 'Security', count: 1 },
      ],
    },
  ],
  empty: { period: 'This week', unread: 0, byType: [] },
  render: (d, k) => {
    const items = k.arr(d.byType);
    if (!items.length)
      return k.page(
        k.header('Notifications', d.period),
        k.empty('No notifications', undefined, 'bell'),
      );
    return k.page(
      k.header('Notifications', d.period, d.unread ? k.pill(d.unread + ' unread', 'accent') : ''),
      k.card(
        k.barList({
          items: items.map((t) => ({ label: t.type, value: t.count })),
          format: 'number',
          title: 'Notifications by type',
        }),
      ),
    );
  },
});

type Prefs = {
  channels: Array<{ label: string; push: boolean; email: boolean; inApp: boolean }>;
  quietHours?: string;
};

export const notificationPreferences = defineWidget<Prefs>({
  domain: 'notifications',
  name: 'preferences',
  title: 'Notification settings',
  description: 'Which notifications reach you by push, email and in-app, plus quiet hours.',
  examples: [
    {
      quietHours: '22:00 – 07:00',
      channels: [
        { label: 'Group expenses', push: true, email: false, inApp: true },
        { label: 'Payment reminders', push: true, email: true, inApp: true },
        { label: 'Limit alerts', push: true, email: false, inApp: true },
        { label: 'Friend requests', push: false, email: false, inApp: true },
        { label: 'Weekly digest', push: false, email: true, inApp: false },
      ],
    },
  ],
  empty: { channels: [] },
  render: (d, k) => {
    const items = k.arr(d.channels);
    if (!items.length)
      return k.page(
        k.header('Settings', 'Notifications'),
        k.empty('Default notification settings', 'You have not customised notifications.', 'bell'),
      );
    const mark = (on: boolean) =>
      on ? '<span class="pos">' + k.icon('check', 14) + '</span>' : '<span class="muted">—</span>';
    return k.page(
      k.header('Settings', 'Notifications', d.quietHours ? k.pill('Quiet ' + d.quietHours) : ''),
      k.table(
        [
          { label: 'Notification' },
          { label: 'Push', align: 'center' },
          { label: 'Email', align: 'center' },
          { label: 'In app', align: 'center' },
        ],
        items.map((c) => [k.esc(c.label), mark(c.push), mark(c.email), mark(c.inApp)]),
        'Notification channels',
      ),
    );
  },
});

type Reminders = {
  currency: string;
  items: Array<{
    person: string;
    group: string;
    amountMinor: Minor;
    sentAt: number;
    direction: 'sent' | 'received';
  }>;
};

export const reminders = defineWidget<Reminders>({
  domain: 'notifications',
  name: 'reminders',
  title: 'Payment reminders',
  description: 'Reminders you sent and received for money owed in groups.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          person: 'Kabir Rao',
          group: 'Goa trip',
          amountMinor: 120_000,
          sentAt: daysAgo(1),
          direction: 'sent',
        },
        {
          person: 'Meera Iyer',
          group: 'Flat 4B',
          amountMinor: 168_000,
          sentAt: daysAgo(2),
          direction: 'received',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(k.header('Reminders', 'Payments'), k.empty('No reminders', undefined, 'bell'));
    return k.page(
      k.header('Reminders', 'Payments'),
      k.list(
        items.map((r) =>
          k.person({
            name: r.person,
            sub:
              (r.direction === 'sent' ? 'You reminded · ' : 'Reminded you · ') +
              r.group +
              ' · ' +
              k.ago(r.sentAt),
            value: k.money(r.amountMinor, d.currency),
            valueTone: r.direction === 'sent' ? 'income' : 'expense',
          }),
        ),
      ),
    );
  },
});

type Digest = {
  currency: string;
  weekLabel: string;
  spentMinor: Minor;
  changePct?: number;
  highlights: string[];
  topCategory?: string;
  upcomingBills?: number;
};

export const digest = defineWidget<Digest>({
  domain: 'notifications',
  name: 'weeklyDigest',
  title: 'Weekly digest',
  description:
    'The week in one card: spending and change, top category, bills ahead and highlights.',
  examples: [
    {
      currency: CUR,
      weekLabel: '17 – 23 Nov',
      spentMinor: 1_082_000,
      changePct: -0.12,
      topCategory: 'Food & dining',
      upcomingBills: 3,
      highlights: [
        'You stayed under your Food limit for the 4th week',
        'Aarav settled ₹2,250 with you',
        'Japan trip goal passed 39%',
      ],
    },
  ],
  empty: { currency: CUR, weekLabel: 'This week', spentMinor: 0, highlights: [] },
  render: (d, k) => {
    if (!k.num(d.spentMinor) && !k.arr(d.highlights).length)
      return k.page(
        k.header('Digest', d.weekLabel),
        k.empty('A quiet week', 'Nothing to report.', 'sun'),
      );
    return k.page(
      k.header('Weekly digest', d.weekLabel),
      k.stats([
        {
          label: 'Spent',
          value: k.money(d.spentMinor, d.currency),
          delta: d.changePct,
          goodWhen: 'down',
        },
        d.topCategory ? { label: 'Top category', value: d.topCategory } : null,
        d.upcomingBills !== undefined
          ? { label: 'Bills next week', value: String(d.upcomingBills) }
          : null,
      ]),
      k.arr(d.highlights).length
        ? k.card(k.steps(d.highlights.map((h) => ({ label: h, done: true }))))
        : '',
    );
  },
});

// ---------- Trash ----------

/** Linked to `finapp.finance.trash.list` ({ items: TrashItem[], retentionDays }). */
type Trash = {
  items?: Array<{
    kind: string;
    id: string;
    title: string;
    subtitle?: string;
    deletedAt: number;
    purgeAt?: number | null;
  }>;
  retentionDays?: number;
};

export const trash = defineWidget<Trash>({
  domain: 'trash',
  name: 'list',
  title: 'Trash',
  description:
    'Deleted transactions, accounts, categories, goals and rules with when each is removed for good.',
  invoking: 'Opening Trash…',
  examples: [
    {
      retentionDays: 30,
      items: [
        {
          kind: 'transaction',
          id: 't1',
          title: 'Uber to airport',
          subtitle: '₹743.50 · expense · Nov 24',
          deletedAt: daysAgo(1),
          purgeAt: daysAgo(-29),
        },
        {
          kind: 'goal',
          id: 'g1',
          title: 'Old phone fund',
          subtitle: 'Goal · ₹40,000.00',
          deletedAt: daysAgo(12),
          purgeAt: daysAgo(-18),
        },
        {
          kind: 'category',
          id: 'c1',
          title: 'Misc',
          subtitle: 'Category · expense',
          deletedAt: daysAgo(26),
          purgeAt: daysAgo(-4),
        },
        {
          kind: 'recurring',
          id: 'r1',
          title: 'Hotstar',
          subtitle: 'Recurring · monthly',
          deletedAt: daysAgo(3),
          purgeAt: daysAgo(-27),
        },
      ],
    },
  ],
  empty: { items: [], retentionDays: 30 },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Trash', 'Deleted items'),
        k.empty(
          'Trash is empty',
          d.retentionDays ? 'Deleted items stay here for ' + d.retentionDays + ' days.' : undefined,
          'trash',
        ),
      );
    const icons: Record<string, string> = {
      transaction: 'receipt',
      account: 'wallet',
      category: 'tag',
      budget: 'target',
      goal: 'target',
      recurring: 'repeat',
    };
    return k.page(
      k.header(
        'Trash',
        k.plural(items.length, 'item'),
        d.retentionDays ? k.pill('Kept ' + d.retentionDays + ' days') : '',
      ),
      k.list(
        items.map((t) => {
          const left = t.purgeAt ? k.daysUntil(t.purgeAt) : null;
          return k.row({
            lead: k.tile(k.icon(icons[t.kind] || 'trash', 16), 'neutral'),
            title: t.title,
            sub: [t.subtitle, 'deleted ' + k.ago(t.deletedAt)].filter(Boolean).join(' · '),
            value: left === null ? 'kept' : left <= 0 ? 'today' : left + 'd left',
            valueTone: left !== null && left <= 7 ? 'warn' : 'muted',
          });
        }),
      ),
      k.actions(
        k.ask('Restore the latest', 'Restore the most recently deleted item from my Trash.'),
      ),
    );
  },
});

type TrashSummary = {
  retentionDays: number;
  byKind: Array<{ kind: string; count: number }>;
  purgingThisWeek: number;
};

export const trashSummary = defineWidget<TrashSummary>({
  domain: 'trash',
  name: 'summary',
  title: 'Trash summary',
  description: 'What is in Trash by type and how much will be deleted for good this week.',
  examples: [
    {
      retentionDays: 30,
      purgingThisWeek: 2,
      byKind: [
        { kind: 'Transactions', count: 9 },
        { kind: 'Recurring', count: 2 },
        { kind: 'Goals', count: 1 },
        { kind: 'Categories', count: 1 },
      ],
    },
  ],
  empty: { retentionDays: 30, purgingThisWeek: 0, byKind: [] },
  render: (d, k) => {
    const items = k.arr(d.byKind).filter((x) => x.count > 0);
    if (!items.length)
      return k.page(k.header('Trash', 'Summary'), k.empty('Trash is empty', undefined, 'trash'));
    return k.page(
      k.header(
        'Trash',
        'Summary',
        d.purgingThisWeek ? k.pill(d.purgingThisWeek + ' purge this week', 'warn') : '',
      ),
      k.card(
        k.segments({
          items: items.map((x, i) => ({ label: x.kind, value: x.count, tone: i })),
          format: 'number',
          title: 'Trash by type',
        }),
      ),
      k.note('Items are deleted for good after ' + d.retentionDays + ' days.'),
    );
  },
});

type Restored = { kind: string; title: string; restoredAt: number; location?: string } | null;

export const restored = defineWidget<Restored>({
  domain: 'trash',
  name: 'restored',
  title: 'Restored',
  description: 'Confirmation that an item came back from Trash and where to find it.',
  examples: [
    {
      kind: 'transaction',
      title: 'Uber to airport',
      restoredAt: daysAgo(0),
      location: 'HDFC Savings · Nov 24',
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.title) return k.page(k.empty('Nothing was restored', undefined, 'restore'));
    return k.page(
      k.notice('Restored ' + d.kind + ': ' + d.title, 'income', 'restore'),
      d.location
        ? k.card(
            k.kv([
              ['Back in', k.esc(d.location)],
              ['Restored', k.esc(k.date(d.restoredAt, 'datetime'))],
            ]),
          )
        : '',
    );
  },
});

type Purge = { items: Array<{ kind: string; title: string; purgeAt: number }> };

export const purgingSoon = defineWidget<Purge>({
  domain: 'trash',
  name: 'purgingSoon',
  title: 'Deleting soon',
  description: 'Trash items that will be permanently deleted in the next 7 days.',
  examples: [
    {
      items: [
        { kind: 'category', title: 'Misc', purgeAt: daysAgo(-4) },
        { kind: 'transaction', title: 'Duplicate Swiggy order', purgeAt: daysAgo(-6) },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .slice()
      .sort((a, b) => a.purgeAt - b.purgeAt);
    if (!items.length)
      return k.page(
        k.header('Trash', 'Deleting soon'),
        k.empty('Nothing deleting this week', undefined, 'check'),
      );
    return k.page(
      k.header('Trash', 'Deleting soon', k.pill(String(items.length), 'warn')),
      k.card(
        k.timeline(
          items.map((t) => ({
            title: t.title,
            sub: t.kind,
            time: 'in ' + Math.max(0, k.daysUntil(t.purgeAt)) + 'd',
            tone: 'warn' as const,
            icon: 'trash',
          })),
        ),
      ),
    );
  },
});

export const peopleWidgets = [
  friends,
  requests,
  search,
  profile,
  suggestions,
  frequent,
  friendBalances,
];
export const chatWidgets = [conversations, thread, dmUnread, dmPinned, paymentRequests];
export const notificationWidgets = [
  notifications,
  notificationSummary,
  notificationPreferences,
  reminders,
  digest,
];
export const trashWidgets = [trash, trashSummary, restored, purgingSoon];
