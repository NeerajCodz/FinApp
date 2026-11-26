import { CUR, PEOPLE, daysAgo, series } from '../sample';
import { defineWidget, type Minor } from '../types';

type History = {
  events?: Array<{
    kind?: string;
    summary?: string;
    actorName?: string;
    createdAt?: number;
    version?: number;
  }>;
};

export const expenseHistory = defineWidget<History>({
  domain: 'groups',
  name: 'expenseHistory',
  title: 'Expense edit history',
  description: 'Every change to a group expense: who edited it, when, and the version.',
  examples: [
    {
      events: [
        {
          kind: 'updated',
          summary: 'Split changed to itemized',
          actorName: 'Alex',
          createdAt: daysAgo(1, 9),
          version: 2,
        },
        {
          kind: 'created',
          summary: 'Added “Beach shack dinner”',
          actorName: 'You',
          createdAt: daysAgo(2, 21),
          version: 1,
        },
      ],
    },
  ],
  empty: { events: [] },
  render: (d, k) => {
    const events = k.arr(d.events);
    if (!events.length)
      return k.empty(
        'No edits yet',
        'This expense has not been changed since it was added.',
        'clock',
      );
    return k.card(
      k.timeline(
        events.map((e) => ({
          title: k.str(e.summary, k.str(e.kind, 'Changed')),
          sub: [e.actorName, k.date(e.createdAt, 'datetime')].filter(Boolean).join(' · '),
          time: e.version ? 'v' + e.version : '',
          tone: e.kind === 'deleted' ? 'expense' : e.kind === 'created' ? 'income' : 'accent',
          icon: e.kind === 'created' ? 'plus' : e.kind === 'deleted' ? 'trash' : 'clock',
        })),
      ),
    );
  },
});

const MEMBERS = ['You', ...PEOPLE.slice(0, 4)];

/** Shape of `finapp.groups.list` (balance/memberCount are optional extras). */
type GroupList = {
  items?: Array<{
    id: string;
    name: string;
    currency: string;
    memberRole?: string;
    updatedAt?: number;
    myBalanceMinor?: Minor;
    memberCount?: number;
    icon?: string;
  }>;
  isDone?: boolean;
};

export const groupList = defineWidget<GroupList>({
  domain: 'groups',
  name: 'list',
  title: 'Groups',
  description: 'Your shared groups with role, last activity and (when known) your balance in each.',
  invoking: 'Loading your groups…',
  examples: [
    {
      items: [
        {
          id: 'g1',
          name: 'Goa trip',
          currency: CUR,
          memberRole: 'admin',
          updatedAt: daysAgo(1),
          myBalanceMinor: 345_000,
          memberCount: 4,
          icon: '🏖️',
        },
        {
          id: 'g2',
          name: 'Flat 4B',
          currency: CUR,
          memberRole: 'member',
          updatedAt: daysAgo(3),
          myBalanceMinor: -128_000,
          memberCount: 3,
          icon: '🏠',
        },
        {
          id: 'g3',
          name: 'Office lunch',
          currency: CUR,
          memberRole: 'member',
          updatedAt: daysAgo(9),
          myBalanceMinor: 0,
          memberCount: 7,
          icon: '🍱',
        },
        {
          id: 'g4',
          name: 'Berlin 2025',
          currency: 'EUR',
          memberRole: 'owner',
          updatedAt: daysAgo(160),
          myBalanceMinor: 4_250,
          memberCount: 5,
          icon: '🇩🇪',
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
        k.header('Groups', 'Shared expenses'),
        k.empty(
          'No groups yet',
          'Create a group for a trip, your flat or friends to split expenses.',
          'users',
        ),
      );
    return k.page(
      k.header('Groups', k.plural(items.length, 'group')),
      k.list(
        items.map((g) => {
          const b = g.myBalanceMinor === undefined ? null : k.num(g.myBalanceMinor);
          return k.row({
            lead: k.glyph(g.name, g.icon, 1),
            title: g.name,
            badge: g.memberRole && g.memberRole !== 'member' ? k.pill(g.memberRole) : '',
            sub: [
              g.memberCount ? k.plural(g.memberCount, 'member') : '',
              g.currency,
              g.updatedAt ? 'active ' + k.ago(g.updatedAt) : '',
            ]
              .filter(Boolean)
              .join(' · '),
            value:
              b === null
                ? ''
                : b === 0
                  ? 'settled'
                  : (b > 0 ? 'owed ' : 'owe ') + k.money(Math.abs(b), g.currency),
            valueTone: b === null ? null : k.toneOf(b),
          });
        }),
      ),
    );
  },
});

/** Shape of `finapp.groups.detail.get`. */
type Detail = {
  id: string;
  name: string;
  currency: string;
  description?: string;
  groupType?: string;
  purpose?: string;
  location?: string;
  startAt?: number;
  endAt?: number;
  memberRole?: string;
  updatedAt?: number;
} | null;

export const groupDetail = defineWidget<Detail>({
  domain: 'groups',
  name: 'detail',
  title: 'Group details',
  description: 'A group’s type, purpose, place, dates, currency and your role.',
  examples: [
    {
      id: 'g1',
      name: 'Goa trip',
      currency: CUR,
      description: 'Long weekend in North Goa',
      groupType: 'trip',
      purpose: 'travel',
      location: 'Anjuna, Goa',
      startAt: Date.UTC(2026, 10, 20),
      endAt: Date.UTC(2026, 10, 24),
      memberRole: 'admin',
      updatedAt: daysAgo(1),
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.name)
      return k.page(
        k.empty('Group not available', 'You may have left it, or it was archived.', 'users'),
      );
    return k.page(
      k.header(
        d.groupType ? d.groupType.charAt(0).toUpperCase() + d.groupType.slice(1) : 'Group',
        d.name,
        k.pill(d.currency),
      ),
      d.description ? k.card(k.esc(d.description)) : '',
      k.card(
        k.kv([
          d.location ? ['Where', k.esc(d.location)] : null,
          d.startAt
            ? [
                'When',
                k.esc(k.date(d.startAt, 'day') + (d.endAt ? ' – ' + k.date(d.endAt, 'day') : '')),
              ]
            : null,
          d.purpose ? ['Purpose', k.esc(d.purpose)] : null,
          d.memberRole ? ['Your role', k.esc(d.memberRole)] : null,
          d.updatedAt ? ['Last activity', k.esc(k.ago(d.updatedAt))] : null,
        ]),
      ),
    );
  },
});

/** Shape of `finapp.groups.members.list`. */
type Members = {
  items?: Array<{
    id: string;
    role?: string;
    joinedAt?: number;
    username?: string;
    displayName: string;
  }>;
  isDone?: boolean;
};

export const members = defineWidget<Members>({
  domain: 'groups',
  name: 'members',
  title: 'Group members',
  description: 'Everyone in a group with their role and when they joined.',
  examples: [
    {
      items: MEMBERS.map((name, i) => ({
        id: 'u' + i,
        displayName: name,
        username: name.split(' ')[0]!.toLowerCase(),
        role: i === 0 ? 'admin' : i === 1 ? 'owner' : 'member',
        joinedAt: daysAgo(40 - i * 5),
      })),
      isDone: true,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Group', 'Members'),
        k.empty('No members', 'Invite people to this group to split expenses.', 'users'),
      );
    return k.page(
      k.header(
        'Group',
        k.plural(items.length, 'member'),
        k.avatars(items.map((m) => m.displayName)),
      ),
      k.list(
        items.map((m) =>
          k.person({
            name: m.displayName,
            sub: [
              m.username ? '@' + m.username : '',
              m.joinedAt ? 'joined ' + k.date(m.joinedAt, 'day') : '',
            ]
              .filter(Boolean)
              .join(' · '),
            badge:
              m.role && m.role !== 'member'
                ? k.pill(m.role, m.role === 'owner' ? 'accent' : null)
                : '',
          }),
        ),
      ),
    );
  },
});

/** Shape of `finapp.groups.invitations.list`. */
type Invites = {
  items?: Array<{
    id: string;
    groupId: string;
    groupName: string;
    createdAt: number;
    inviter?: { id: string; displayName: string } | null;
  }>;
};

export const invitations = defineWidget<Invites>({
  domain: 'groups',
  name: 'invitations',
  title: 'Group invitations',
  description: 'Pending invitations to join groups, who sent them and when.',
  examples: [
    {
      items: [
        {
          id: 'i1',
          groupId: 'g9',
          groupName: 'Coorg weekend',
          createdAt: daysAgo(0, 8),
          inviter: { id: 'u2', displayName: 'Meera Iyer' },
        },
        {
          id: 'i2',
          groupId: 'g10',
          groupName: 'Badminton club',
          createdAt: daysAgo(4),
          inviter: { id: 'u3', displayName: 'Kabir Rao' },
        },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Groups', 'Invitations'),
        k.empty('No pending invitations', undefined, 'users'),
      );
    return k.page(
      k.header('Groups', 'Invitations', k.pill(String(items.length), 'accent')),
      k.list(
        items.map((i) =>
          k.row({
            lead: k.glyph(i.groupName, undefined, 1),
            title: i.groupName,
            sub: (i.inviter ? 'From ' + i.inviter.displayName + ' · ' : '') + k.ago(i.createdAt),
          }),
        ),
      ),
      k.actions(k.ask('Accept all', 'Accept my pending group invitations.')),
    );
  },
});

/** Shape of `finapp.groups.settlements.list` (fromName/toName optional). */
type Settlements = {
  items?: Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    fromName?: string;
    toName?: string;
    amountMinor: Minor;
    currency: string;
    occurredAt: number;
  }>;
  isDone?: boolean;
};

export const settlements = defineWidget<Settlements>({
  domain: 'groups',
  name: 'settlements',
  title: 'Settlements',
  description: 'Payments recorded between group members, newest first, with the total settled.',
  examples: [
    {
      items: [
        {
          id: 's1',
          fromUserId: 'u1',
          toUserId: 'me',
          fromName: 'Aarav Shah',
          toName: 'You',
          amountMinor: 225_000,
          currency: CUR,
          occurredAt: daysAgo(1),
        },
        {
          id: 's2',
          fromUserId: 'me',
          toUserId: 'u2',
          fromName: 'You',
          toName: 'Meera Iyer',
          amountMinor: 80_000,
          currency: CUR,
          occurredAt: daysAgo(6),
        },
        {
          id: 's3',
          fromUserId: 'u3',
          toUserId: 'u2',
          fromName: 'Kabir Rao',
          toName: 'Meera Iyer',
          amountMinor: 145_000,
          currency: CUR,
          occurredAt: daysAgo(11),
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
        k.header('Group', 'Settlements'),
        k.empty(
          'No settlements yet',
          'Payments between members appear here once recorded.',
          'swap',
        ),
      );
    const cur = items[0]!.currency;
    return k.page(
      k.header(
        'Group',
        'Settlements',
        k.pill(k.money(k.sum(items.map((s) => s.amountMinor)), cur) + ' settled'),
      ),
      k.list(
        items.map((s) =>
          k.row({
            lead: k.tile(k.icon('swap', 16), 'income'),
            title: (s.fromName || 'Member') + ' → ' + (s.toName || 'Member'),
            sub: k.date(s.occurredAt, 'day'),
            value: k.money(s.amountMinor, s.currency),
          }),
        ),
      ),
    );
  },
});

/** Shape of `finapp.groups.messages.list`. */
type Chat = {
  groupName?: string;
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

export const groupChat = defineWidget<Chat>({
  domain: 'groups',
  name: 'chat',
  title: 'Group chat',
  description:
    'Recent messages in a group chat, oldest to newest, with system events shown inline.',
  examples: [
    {
      groupName: 'Goa trip',
      meName: 'You',
      items: [
        {
          id: 'm4',
          kind: 'text',
          text: 'Paid! Check the app 🙌',
          createdAt: daysAgo(0, 11),
          senderName: 'Aarav Shah',
        },
        {
          id: 'm3',
          kind: 'text',
          text: 'Settling up tonight, will send via UPI',
          createdAt: daysAgo(0, 9),
          senderName: 'You',
        },
        {
          id: 'm2',
          kind: 'expense',
          text: 'Meera added “Scooter rental” · ₹2,400',
          createdAt: daysAgo(1, 18),
          senderName: 'Meera Iyer',
        },
        {
          id: 'm1',
          kind: 'text',
          text: 'Who has the beach shack bill?',
          createdAt: daysAgo(1, 14),
          senderName: 'Kabir Rao',
        },
      ],
      isDone: false,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items).slice().reverse();
    if (!items.length)
      return k.page(
        k.header('Chat', d.groupName || 'Group'),
        k.empty('No messages yet', 'Say hi to the group.', 'chat'),
      );
    const me = d.meName || 'You';
    return k.page(
      k.header(
        'Chat',
        d.groupName || 'Group',
        d.isDone === false ? k.pill('Older messages available') : '',
      ),
      '<div class="thread">' +
        items
          .map((m) =>
            m.kind && m.kind !== 'text'
              ? '<p class="note" style="text-align:center">' +
                k.icon('receipt', 12) +
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

type Exp = {
  currency: string;
  group: string;
  items: Array<{
    id: string;
    title: string;
    amountMinor: Minor;
    paidBy: string;
    myShareMinor?: Minor;
    occurredAt: number;
    categoryIcon?: string;
  }>;
};

export const groupExpenses = defineWidget<Exp>({
  domain: 'groups',
  name: 'expenses',
  title: 'Group expenses',
  description: 'Expenses in a group with who paid and your share of each.',
  examples: [
    {
      currency: CUR,
      group: 'Goa trip',
      items: [
        {
          id: 'e1',
          title: 'Beach shack dinner',
          amountMinor: 360_000,
          paidBy: 'You',
          myShareMinor: 120_000,
          occurredAt: daysAgo(2),
          categoryIcon: '🍜',
        },
        {
          id: 'e2',
          title: 'Scooter rental',
          amountMinor: 240_000,
          paidBy: 'Meera Iyer',
          myShareMinor: 60_000,
          occurredAt: daysAgo(3),
          categoryIcon: '🛵',
        },
        {
          id: 'e3',
          title: 'Villa — 3 nights',
          amountMinor: 2_400_000,
          paidBy: 'Aarav Shah',
          myShareMinor: 600_000,
          occurredAt: daysAgo(5),
          categoryIcon: '🏡',
        },
        {
          id: 'e4',
          title: 'Groceries',
          amountMinor: 186_000,
          paidBy: 'You',
          myShareMinor: 46_500,
          occurredAt: daysAgo(4),
          categoryIcon: '🛒',
        },
      ],
    },
  ],
  empty: { currency: CUR, group: 'Group', items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Expenses', d.group),
        k.empty('No expenses yet', 'Add the first shared expense to this group.', 'receipt'),
      );
    return k.page(
      k.header(
        'Expenses',
        d.group,
        k.pill(k.money(k.sum(items.map((e) => e.amountMinor)), d.currency)),
      ),
      k.list(
        items.map((e) =>
          k.row({
            lead: k.glyph(e.title, e.categoryIcon),
            title: e.title,
            sub: e.paidBy + ' paid · ' + k.date(e.occurredAt, 'day'),
            value: k.money(e.amountMinor, d.currency),
            valueSub:
              e.myShareMinor !== undefined
                ? 'your share ' + k.money(e.myShareMinor, d.currency)
                : '',
          }),
        ),
      ),
    );
  },
});

type PaidVsShare = {
  currency: string;
  group: string;
  members: Array<{ name: string; paidMinor: Minor; shareMinor: Minor }>;
};
const paid = [1_046_000, 240_000, 2_400_000, 0, 120_000];
const share = [826_500, 826_500, 826_500, 826_500, 480_000];

export const memberBreakdown = defineWidget<PaidVsShare>({
  domain: 'groups',
  name: 'memberBreakdown',
  title: 'Paid vs share',
  description:
    'What each member paid against their share of group expenses, as grouped columns with the difference.',
  examples: [
    {
      currency: CUR,
      group: 'Goa trip',
      members: MEMBERS.map((name, i) => ({
        name: name.split(' ')[0]!,
        paidMinor: paid[i]!,
        shareMinor: share[i]!,
      })),
    },
  ],
  empty: { currency: CUR, group: 'Group', members: [] },
  render: (d, k) => {
    const list = k.arr(d.members);
    if (!list.length)
      return k.page(
        k.header('Group', 'Paid vs share'),
        k.empty('No expenses yet', undefined, 'users'),
      );
    return k.page(
      k.header('Paid vs share', d.group),
      k.card(
        k.columns({
          labels: list.map((m) => m.name),
          series: [
            { name: 'Paid', values: list.map((m) => k.num(m.paidMinor)), tone: 0 },
            { name: 'Share', values: list.map((m) => k.num(m.shareMinor)), tone: 'neutral' },
          ],
          net: list.map((m) => k.num(m.paidMinor) - k.num(m.shareMinor)),
          netName: 'Balance',
          currency: d.currency,
          title: 'Paid and share by member',
        }),
      ),
    );
  },
});

type GroupCats = {
  currency: string;
  group: string;
  categories: Array<{ name: string; icon?: string; amountMinor: Minor }>;
};

export const groupCategories = defineWidget<GroupCats>({
  domain: 'groups',
  name: 'spendingByCategory',
  title: 'Group spending by category',
  description: 'Where a group’s money went, as a donut with the group total.',
  examples: [
    {
      currency: CUR,
      group: 'Goa trip',
      categories: [
        { name: 'Stay', icon: '🏡', amountMinor: 2_400_000 },
        { name: 'Food', icon: '🍜', amountMinor: 1_120_000 },
        { name: 'Transport', icon: '🛵', amountMinor: 420_000 },
        { name: 'Activities', icon: '🏄', amountMinor: 380_000 },
        { name: 'Groceries', icon: '🛒', amountMinor: 186_000 },
      ],
    },
  ],
  empty: { currency: CUR, group: 'Group', categories: [] },
  render: (d, k) => {
    const cats = k.arr(d.categories).filter((c) => k.num(c.amountMinor) > 0);
    if (!cats.length)
      return k.page(k.header('Group', d.group), k.empty('No spending yet', undefined, 'spark'));
    return k.page(
      k.header('Group spending', d.group),
      k.card(
        k.donut({
          items: cats.map((c) => ({
            label: (c.icon ? c.icon + ' ' : '') + c.name,
            value: k.num(c.amountMinor),
          })),
          currency: d.currency,
          centerLabel: 'Group total',
          title: 'Group spending by category',
        }),
      ),
    );
  },
});

type Activity = {
  group: string;
  items: Array<{
    kind: 'expense' | 'settlement' | 'member' | 'edit' | 'comment';
    actor: string;
    text: string;
    at: number;
    amount?: string;
  }>;
};

export const groupActivity = defineWidget<Activity>({
  domain: 'groups',
  name: 'activity',
  title: 'Group activity',
  description:
    'A timeline of what happened in a group: expenses, settlements, edits and new members.',
  examples: [
    {
      group: 'Goa trip',
      items: [
        {
          kind: 'settlement',
          actor: 'Aarav',
          text: 'Aarav paid you',
          at: daysAgo(0, 11),
          amount: '₹2,250',
        },
        {
          kind: 'expense',
          actor: 'Meera',
          text: 'Meera added Scooter rental',
          at: daysAgo(1, 18),
          amount: '₹2,400',
        },
        {
          kind: 'edit',
          actor: 'You',
          text: 'You changed the split on Beach shack dinner',
          at: daysAgo(1, 9),
        },
        { kind: 'member', actor: 'Diya', text: 'Diya joined the group', at: daysAgo(4) },
      ],
    },
  ],
  empty: { group: 'Group', items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Activity', d.group),
        k.empty('Nothing has happened yet', undefined, 'clock'),
      );
    const icons: Record<string, string> = {
      expense: 'receipt',
      settlement: 'swap',
      member: 'user',
      edit: 'clock',
      comment: 'chat',
    };
    const tones: Record<string, 'accent' | 'income' | 'neutral'> = {
      expense: 'accent',
      settlement: 'income',
      member: 'neutral',
      edit: 'neutral',
      comment: 'neutral',
    };
    return k.page(
      k.header('Activity', d.group),
      k.card(
        k.timeline(
          items.map((i) => ({
            title: i.text,
            sub: k.ago(i.at),
            icon: icons[i.kind],
            tone: tones[i.kind],
            value: i.amount,
          })),
        ),
      ),
    );
  },
});

type Trip = {
  currency: string;
  name: string;
  startAt: number;
  endAt: number;
  totalMinor: Minor;
  members: number;
  days: Array<{ label: string; amountMinor: Minor }>;
  myShareMinor?: Minor;
};

export const tripSummary = defineWidget<Trip>({
  domain: 'groups',
  name: 'tripSummary',
  title: 'Trip summary',
  description: 'A trip at a glance: total, per person, per day, and daily spending columns.',
  examples: [
    {
      currency: CUR,
      name: 'Goa trip',
      startAt: Date.UTC(2026, 10, 20),
      endAt: Date.UTC(2026, 10, 24),
      totalMinor: 4_506_000,
      members: 4,
      myShareMinor: 1_126_500,
      days: ['Fri 20', 'Sat 21', 'Sun 22', 'Mon 23', 'Tue 24'].map((label, i) => ({
        label,
        amountMinor: [2_820_000, 520_000, 610_000, 380_000, 176_000][i]!,
      })),
    },
  ],
  empty: { currency: CUR, name: 'Trip', startAt: 0, endAt: 0, totalMinor: 0, members: 0, days: [] },
  render: (d, k) => {
    if (!k.num(d.totalMinor))
      return k.page(
        k.header('Trip', d.name),
        k.empty('No trip expenses yet', 'Add expenses as you go to see the trip summary.', 'globe'),
      );
    const days = k.arr(d.days);
    return k.page(
      k.header(
        'Trip',
        d.name,
        d.startAt ? k.pill(k.date(d.startAt, 'day') + ' – ' + k.date(d.endAt, 'day')) : '',
      ),
      k.stats([
        { label: 'Total', value: k.money(d.totalMinor, d.currency) },
        {
          label: 'Per person',
          value: k.money(k.num(d.totalMinor) / Math.max(1, d.members), d.currency),
        },
        {
          label: 'Per day',
          value: k.money(k.num(d.totalMinor) / Math.max(1, days.length), d.currency),
        },
        d.myShareMinor !== undefined
          ? { label: 'Your share', value: k.money(d.myShareMinor, d.currency), tone: 'accent' }
          : null,
      ]),
      days.length
        ? k.card(
            k.columns({
              labels: days.map((x) => x.label),
              series: [{ name: 'Spent', values: days.map((x) => k.num(x.amountMinor)), tone: 1 }],
              currency: d.currency,
              height: 160,
              title: 'Trip spending by day',
            }),
          )
        : '',
    );
  },
});

type Matrix = { currency: string; group: string; names: string[]; owes: number[][] };

export const balanceMatrix = defineWidget<Matrix>({
  domain: 'groups',
  name: 'balanceMatrix',
  title: 'Who owes whom',
  description:
    'A matrix of pairwise debts (row owes column) before simplification, shaded by amount.',
  examples: [
    {
      currency: CUR,
      group: 'Flat 4B',
      names: ['You', 'Aarav', 'Meera', 'Kabir'],
      owes: [
        [0, 0, 42_000, 0],
        [128_000, 0, 36_000, 0],
        [0, 0, 0, 18_000],
        [64_000, 22_000, 0, 0],
      ],
    },
  ],
  empty: { currency: CUR, group: 'Group', names: [], owes: [] },
  render: (d, k) => {
    const total = k.sum(k.arr(d.owes).map((r) => k.sum(r)));
    if (!total)
      return k.page(
        k.header('Balances', d.group),
        k.empty('Everyone is square', undefined, 'check'),
      );
    return k.page(
      k.header('Who owes whom', d.group),
      k.card(
        k.heatmap({
          rows: d.names.map((n) => n + ' owes'),
          cols: d.names,
          values: d.owes,
          currency: d.currency,
          tone: 'expense',
          maxCell: 64,
          title: 'Pairwise debts',
        }),
      ),
      k.note(
        'Read across: each row owes the person in the column. Settle-up simplifies these into fewer payments.',
      ),
    );
  },
});

type Progress = {
  currency: string;
  group: string;
  settledMinor: Minor;
  outstandingMinor: Minor;
  transfersLeft: number;
};

export const settleProgress = defineWidget<Progress>({
  domain: 'groups',
  name: 'settleProgress',
  title: 'Settle-up progress',
  description: 'How much of a group’s debt has been settled so far and how many payments remain.',
  examples: [
    {
      currency: CUR,
      group: 'Goa trip',
      settledMinor: 305_000,
      outstandingMinor: 345_000,
      transfersLeft: 2,
    },
  ],
  empty: { currency: CUR, group: 'Group', settledMinor: 0, outstandingMinor: 0, transfersLeft: 0 },
  render: (d, k) => {
    const s = k.num(d.settledMinor);
    const o = k.num(d.outstandingMinor);
    if (!s && !o)
      return k.page(
        k.header('Settle up', d.group),
        k.empty('Nothing to settle', 'No one owes anything in this group.', 'check'),
      );
    return k.page(
      k.header('Settle up', d.group),
      k.card(
        '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
          k.ring({ value: s / (s + o), size: 112, tone: o ? 'accent' : 'income', sub: 'settled' }) +
          '<div class="grow">' +
          k.kv([
            ['Settled', k.text(k.money(s, d.currency), 'income')],
            ['Outstanding', k.text(k.money(o, d.currency), o ? 'warn' : null)],
            ['Payments left', k.esc(String(d.transfersLeft))],
          ]) +
          '</div></div>',
      ),
    );
  },
});

type Compare = {
  currency: string;
  groups: Array<{ name: string; totalMinor: Minor; myShareMinor: Minor; icon?: string }>;
};

export const groupsCompared = defineWidget<Compare>({
  domain: 'groups',
  name: 'compare',
  title: 'Groups compared',
  description: 'Your share of spending in each group this year, ranked.',
  examples: [
    {
      currency: CUR,
      groups: [
        { name: 'Flat 4B', icon: '🏠', totalMinor: 18_400_000, myShareMinor: 6_133_000 },
        { name: 'Goa trip', icon: '🏖️', totalMinor: 4_506_000, myShareMinor: 1_126_500 },
        { name: 'Office lunch', icon: '🍱', totalMinor: 3_200_000, myShareMinor: 457_000 },
        { name: 'Badminton', icon: '🏸', totalMinor: 960_000, myShareMinor: 160_000 },
      ],
    },
  ],
  empty: { currency: CUR, groups: [] },
  render: (d, k) => {
    const groups = k.arr(d.groups);
    if (!groups.length)
      return k.page(k.header('Groups', 'Compared'), k.empty('No groups yet', undefined, 'users'));
    return k.page(
      k.header('Groups', 'Your share this year'),
      k.card(
        k.barList({
          items: groups.map((g) => ({
            label: g.name,
            value: k.num(g.myShareMinor),
            lead: k.glyph(g.name, g.icon, 1),
            sub: 'Group total ' + k.money(g.totalMinor, d.currency, { compact: true }),
            tone: 1,
          })),
          currency: d.currency,
          title: 'Your share by group',
        }),
      ),
    );
  },
});

type Invite = {
  group: string;
  code: string;
  expiresAt?: number;
  uses?: number;
  maxUses?: number;
  createdBy?: string;
} | null;

export const inviteLink = defineWidget<Invite>({
  domain: 'groups',
  name: 'inviteLink',
  title: 'Invite link',
  description: 'A group invite code with expiry and usage, ready to share.',
  examples: [
    {
      group: 'Goa trip',
      code: 'GOA-7K2P-QX',
      expiresAt: daysAgo(-7),
      uses: 2,
      maxUses: 10,
      createdBy: 'You',
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.code)
      return k.page(
        k.empty(
          'No active invite link',
          'Create an invite link to let people join this group.',
          'link',
        ),
      );
    return k.page(
      k.header('Invite', d.group),
      k.card(
        '<div style="display:grid;gap:10px;justify-items:center;text-align:center;padding:8px 0">' +
          k.tile(k.icon('link', 20), 1, 48) +
          '<div class="big" style="font-size:24px;letter-spacing:0.08em">' +
          k.esc(d.code) +
          '</div><p class="sub" style="margin:0">' +
          k.esc(
            [
              d.expiresAt ? 'Expires ' + k.date(d.expiresAt, 'day') : 'Never expires',
              d.maxUses ? (d.uses || 0) + ' of ' + d.maxUses + ' uses' : (d.uses || 0) + ' uses',
              d.createdBy ? 'by ' + d.createdBy : '',
            ]
              .filter(Boolean)
              .join(' · '),
          ) +
          '</p></div>',
      ),
      d.maxUses ? k.progress((d.uses || 0) / d.maxUses, 1) : '',
    );
  },
});

type Pinned = {
  group: string;
  items: Array<{ text: string; senderName: string; createdAt: number; pinnedBy?: string }>;
};

export const pinned = defineWidget<Pinned>({
  domain: 'groups',
  name: 'pinned',
  title: 'Pinned messages',
  description: 'Messages pinned in a group chat — house rules, account numbers, plans.',
  examples: [
    {
      group: 'Flat 4B',
      items: [
        {
          text: 'Rent goes to the landlord on the 1st — HDFC a/c ending 2291',
          senderName: 'Aarav Shah',
          createdAt: daysAgo(60),
          pinnedBy: 'Aarav',
        },
        {
          text: 'Wi-Fi password is on the fridge 🙂',
          senderName: 'Meera Iyer',
          createdAt: daysAgo(30),
        },
      ],
    },
  ],
  empty: { group: 'Group', items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Pinned', d.group),
        k.empty('Nothing pinned', 'Pin important messages to keep them handy.', 'pin'),
      );
    return k.page(
      k.header('Pinned', d.group),
      k.list(
        items.map((m) =>
          k.row({
            lead: k.tile(k.icon('pin', 16), 'warn'),
            title: m.text,
            sub:
              m.senderName +
              ' · ' +
              k.date(m.createdAt, 'day') +
              (m.pinnedBy ? ' · pinned by ' + m.pinnedBy : ''),
          }),
        ),
      ),
    );
  },
});

/** Unread chat counts per group (`finapp.groups.unread_counts` returns `{ counts }`). */
type Unread = {
  counts?: Array<{ groupId: string; groupName?: string; count: number }> | Record<string, number>;
};

export const unread = defineWidget<Unread>({
  domain: 'groups',
  name: 'unread',
  title: 'Unread group messages',
  description: 'How many unread messages each group chat has.',
  examples: [
    {
      counts: [
        { groupId: 'g1', groupName: 'Goa trip', count: 12 },
        { groupId: 'g2', groupName: 'Flat 4B', count: 3 },
        { groupId: 'g3', groupName: 'Office lunch', count: 1 },
      ],
    },
  ],
  empty: { counts: [] },
  render: (d, k) => {
    const raw = d.counts;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? Object.keys(raw).map((key) => ({
            groupId: key,
            groupName: key,
            count: k.num((raw as Record<string, number>)[key]),
          }))
        : [];
    const items = list.filter((c) => c.count > 0);
    if (!items.length)
      return k.page(
        k.header('Chats', 'Unread'),
        k.empty('All caught up', 'No unread messages in your groups.', 'check'),
      );
    return k.page(
      k.header('Chats', 'Unread', k.pill(String(k.sum(items.map((c) => c.count))), 'accent')),
      k.list(
        items.map((c) =>
          k.row({
            lead: k.glyph(c.groupName || 'Group', undefined, 1),
            title: c.groupName || 'Group',
            value: String(c.count),
            valueSub: 'unread',
            valueTone: 'accent',
          }),
        ),
      ),
    );
  },
});

type SharedHistory = {
  currency: string;
  person: string;
  netMinor: Minor;
  groups: Array<{ name: string; balanceMinor: Minor }>;
  items: Array<{
    title: string;
    group: string;
    amountMinor: Minor;
    occurredAt: number;
    direction: 'you_paid' | 'they_paid' | 'settlement';
  }>;
};

export const sharedHistory = defineWidget<SharedHistory>({
  domain: 'groups',
  name: 'sharedHistory',
  title: 'Shared history with a person',
  description:
    'Everything you share with one person across groups: net balance, per-group balance and recent items.',
  examples: [
    {
      currency: CUR,
      person: 'Meera Iyer',
      netMinor: -128_000,
      groups: [
        { name: 'Flat 4B', balanceMinor: -168_000 },
        { name: 'Goa trip', balanceMinor: 40_000 },
      ],
      items: [
        {
          title: 'Electricity bill',
          group: 'Flat 4B',
          amountMinor: 80_000,
          occurredAt: daysAgo(3),
          direction: 'they_paid',
        },
        {
          title: 'Scooter rental',
          group: 'Goa trip',
          amountMinor: 60_000,
          occurredAt: daysAgo(5),
          direction: 'they_paid',
        },
        {
          title: 'Settled up',
          group: 'Flat 4B',
          amountMinor: 120_000,
          occurredAt: daysAgo(20),
          direction: 'settlement',
        },
      ],
    },
  ],
  empty: { currency: CUR, person: 'Friend', netMinor: 0, groups: [], items: [] },
  render: (d, k) => {
    const net = k.num(d.netMinor);
    if (!k.arr(d.items).length && !net)
      return k.page(
        k.header('Shared with', d.person),
        k.empty(
          'Nothing shared yet',
          'Expenses you split with ' + d.person + ' will show here.',
          'users',
        ),
      );
    return k.page(
      k.header('Shared with', d.person, k.avatar(d.person, 36)),
      k.hero({
        label: net === 0 ? 'All square' : net > 0 ? d.person + ' owes you' : 'You owe ' + d.person,
        value: k.money(Math.abs(net), d.currency),
        tone: k.toneOf(net),
      }),
      k.arr(d.groups).length
        ? k.section(
            'By group',
            k.list(
              d.groups.map((g) =>
                k.row({
                  lead: k.glyph(g.name, undefined, 1),
                  title: g.name,
                  value: k.money(g.balanceMinor, d.currency, { sign: true }),
                  valueTone: k.toneOf(k.num(g.balanceMinor)),
                }),
              ),
            ),
          )
        : '',
      k.arr(d.items).length
        ? k.section(
            'Recent',
            k.list(
              d.items.map((i) =>
                k.row({
                  lead: k.tile(
                    k.icon(i.direction === 'settlement' ? 'swap' : 'receipt', 16),
                    i.direction === 'settlement' ? 'income' : 'accent',
                  ),
                  title: i.title,
                  sub:
                    i.group +
                    ' · ' +
                    (i.direction === 'you_paid'
                      ? 'you paid'
                      : i.direction === 'they_paid'
                        ? d.person.split(' ')[0] + ' paid'
                        : 'settlement') +
                    ' · ' +
                    k.date(i.occurredAt, 'day'),
                  value: k.money(i.amountMinor, d.currency),
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type Daily = {
  currency: string;
  group: string;
  perPerson: Array<{ name: string; valuesMinor: number[] }>;
  days: string[];
};

export const perPersonDaily = defineWidget<Daily>({
  domain: 'groups',
  name: 'perPersonDaily',
  title: 'Who paid each day',
  description: 'Stacked daily columns of what each member paid during a trip or event.',
  examples: [
    {
      currency: CUR,
      group: 'Goa trip',
      days: ['Fri', 'Sat', 'Sun', 'Mon', 'Tue'],
      perPerson: ['You', 'Aarav', 'Meera', 'Kabir'].map((name, i) => ({
        name,
        valuesMinor: series(5, [300_000, 600_000, 200_000, 100_000][i]!, 0.8, 601 + i),
      })),
    },
  ],
  empty: { currency: CUR, group: 'Group', perPerson: [], days: [] },
  render: (d, k) => {
    if (!k.arr(d.perPerson).length || !k.arr(d.days).length)
      return k.page(k.header('Group', d.group), k.empty('No expenses yet', undefined, 'users'));
    return k.page(
      k.header('Who paid each day', d.group),
      k.card(
        k.columns({
          labels: d.days,
          series: d.perPerson.slice(0, 8).map((p) => ({ name: p.name, values: p.valuesMinor })),
          mode: 'stacked',
          currency: d.currency,
          title: 'Paid per member per day',
        }),
      ),
    );
  },
});

type Created = {
  group: string;
  expense: {
    title: string;
    amountMinor: Minor;
    currency: string;
    paidBy: string;
    split: Array<{ name: string; amountMinor: Minor }>;
  };
} | null;

export const expenseAdded = defineWidget<Created>({
  domain: 'groups',
  name: 'expenseAdded',
  title: 'Expense added',
  description: 'Confirmation of a new group expense with the split per member as a segmented bar.',
  examples: [
    {
      group: 'Goa trip',
      expense: {
        title: 'Sunset cruise',
        amountMinor: 480_000,
        currency: CUR,
        paidBy: 'You',
        split: [
          { name: 'You', amountMinor: 120_000 },
          { name: 'Aarav', amountMinor: 120_000 },
          { name: 'Meera', amountMinor: 120_000 },
          { name: 'Kabir', amountMinor: 120_000 },
        ],
      },
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.expense) return k.page(k.empty('No expense was added', undefined, 'receipt'));
    const e = d.expense;
    return k.page(
      k.notice(
        'Added to ' + d.group + ': ' + e.title + ' · ' + k.money(e.amountMinor, e.currency),
        'income',
        'check',
      ),
      k.card(
        k.kv([
          ['Paid by', k.esc(e.paidBy)],
          ['Amount', k.esc(k.money(e.amountMinor, e.currency))],
        ]) +
          '<div style="margin-top:10px">' +
          k.segments({
            items: k
              .arr(e.split)
              .map((s, i) => ({ label: s.name, value: k.num(s.amountMinor), tone: i })),
            currency: e.currency,
            title: 'Split',
          }) +
          '</div>',
      ),
    );
  },
});

export const groupWidgets = [
  groupList,
  groupDetail,
  members,
  invitations,
  settlements,
  groupChat,
  expenseHistory,
  groupExpenses,
  memberBreakdown,
  groupCategories,
  groupActivity,
  tripSummary,
  balanceMatrix,
  settleProgress,
  groupsCompared,
  inviteLink,
  pinned,
  unread,
  sharedHistory,
  perPersonDaily,
  expenseAdded,
];
