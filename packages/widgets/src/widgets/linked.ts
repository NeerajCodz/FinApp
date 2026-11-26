/**
 * Widgets written against the exact results of MCP tools added in 1.11.0: inbox, person
 * analytics, signed-in devices, notification status, FinAI settings and category limits.
 * Render functions only use their two arguments (they also run in the browser as source text).
 */
import { CUR, PEOPLE, daysAgo } from '../sample';
import { defineWidget, type Minor } from '../types';

// ---------- finapp.social.inbox ----------

type InboxRow = {
  id: string;
  displayName: string;
  username?: string;
  conversationId?: string | null;
  lastMessageAt?: number | null;
  unreadCount?: number;
  unreadCapped?: boolean;
  active?: boolean | null;
  lastSeenAt?: number | null;
};

export const inbox = defineWidget<{ items?: InboxRow[] }>({
  domain: 'chats',
  name: 'inbox',
  title: 'Inbox',
  description: 'Everyone you talk to, unread conversations first, with who is active now.',
  invoking: 'Opening your inbox…',
  invoked: 'Inbox ready',
  examples: [
    {
      items: PEOPLE.slice(0, 6).map((name, i) => ({
        id: 'u' + i,
        displayName: name,
        username: name.split(' ')[0]!.toLowerCase(),
        conversationId: i < 5 ? 'c' + i : null,
        lastMessageAt: i < 5 ? daysAgo(i * 0.4) : null,
        unreadCount: [3, 1, 0, 0, 0, 0][i],
        active: i === 0 || i === 3,
        lastSeenAt: daysAgo(i + 0.2),
      })),
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const rows = k.arr(d.items);
    if (!rows.length)
      return k.page(
        k.header('Messages', 'Inbox'),
        k.empty('No conversations yet', 'Message a friend to start chatting.', 'chat'),
      );
    const unread = k.sum(rows.map((r) => k.num(r.unreadCount)));
    const activeNow = rows.filter((r) => r.active === true).length;
    return k.page(
      k.header('Messages', 'Inbox', unread ? k.pill(unread + ' unread', 'accent') : ''),
      k.stats([
        { label: 'Conversations', value: k.number(rows.filter((r) => r.conversationId).length) },
        { label: 'Unread', value: k.number(unread), tone: unread ? 'accent' : null },
        { label: 'Active now', value: k.number(activeNow), tone: activeNow ? 'income' : null },
      ]),
      k.list(
        rows.map((r) =>
          k.row({
            lead: k.avatar(r.displayName),
            title: r.displayName,
            sub:
              (r.username ? '@' + r.username + ' · ' : '') +
              (r.active === true
                ? 'Active now'
                : r.lastMessageAt
                  ? 'Last message ' + k.ago(r.lastMessageAt)
                  : r.lastSeenAt
                    ? 'Seen ' + k.ago(r.lastSeenAt)
                    : 'No messages yet'),
            badge: r.unreadCount ? String(r.unreadCount) + (r.unreadCapped ? '+' : '') : undefined,
            muted: !r.conversationId,
          }),
        ),
      ),
    );
  },
});

// ---------- finapp.social.people.analytics ----------

type PersonAnalytics = {
  profile: { id: string; displayName: string; username?: string };
  friends: boolean;
  friendsSince?: number | null;
  conversationSince?: number | null;
  active?: boolean | null;
  lastSeenAt?: number | null;
  days: Array<{ dayStart: number; sent: number; received: number }>;
  totalMessages: number;
  mix: { text: number; image: number; audio: number; ai: number };
  sharedGroups: Array<{ id: string; name: string; icon?: string }>;
} | null;

export const personAnalytics = defineWidget<PersonAnalytics>({
  domain: 'people',
  name: 'analytics',
  title: 'Activity with a person',
  description:
    'Your last 30 days with one person: messages per day, message mix and shared groups.',
  invoking: 'Looking at your activity…',
  invoked: 'Activity ready',
  examples: [
    {
      profile: { id: 'u1', displayName: PEOPLE[1]!, username: 'sam' },
      friends: true,
      friendsSince: daysAgo(210),
      conversationSince: daysAgo(180),
      active: false,
      lastSeenAt: daysAgo(0.1),
      days: Array.from({ length: 30 }, (_, i) => ({
        dayStart: daysAgo(29 - i),
        sent: (i * 7) % 5,
        received: (i * 5) % 6,
      })),
      totalMessages: 152,
      mix: { text: 131, image: 12, audio: 6, ai: 3 },
      sharedGroups: [
        { id: 'g1', name: 'Goa trip', icon: '🏖️' },
        { id: 'g2', name: 'Flat 4B', icon: '🏠' },
      ],
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d)
      return k.page(
        k.header('People', 'Activity'),
        k.empty(
          'Nothing to show',
          'Activity is only shown for people you share a chat, friendship or group with.',
          'user',
        ),
      );
    const days = k.arr(d.days);
    const sent = k.sum(days.map((x) => k.num(x.sent)));
    const received = k.sum(days.map((x) => k.num(x.received)));
    const busiest = days.reduce(
      (best, x) =>
        k.num(x.sent) + k.num(x.received) > best.n
          ? { n: k.num(x.sent) + k.num(x.received), at: x.dayStart }
          : best,
      { n: 0, at: 0 },
    );
    const mix = d.mix || { text: 0, image: 0, audio: 0, ai: 0 };
    const groups = k.arr(d.sharedGroups);
    return k.page(
      k.header(
        'Last 30 days',
        d.profile.displayName,
        d.friends ? k.pill('Friends', 'income') : k.pill('Not friends', 'muted'),
      ),
      k.stats([
        { label: 'Messages', value: k.number(k.num(d.totalMessages)) },
        { label: 'You sent', value: k.number(sent) },
        { label: 'They sent', value: k.number(received) },
        busiest.n
          ? { label: 'Busiest day', value: k.date(busiest.at, 'day'), sub: busiest.n + ' messages' }
          : null,
      ]),
      days.length && k.num(d.totalMessages)
        ? k.card(
            k.columns({
              title: 'Messages per day',
              format: 'number',
              mode: 'stacked',
              labels: days.map((x) => k.date(x.dayStart, 'day')),
              series: [
                { name: 'You', values: days.map((x) => k.num(x.sent)), tone: 0 },
                {
                  name: d.profile.displayName.split(' ')[0] || 'Them',
                  values: days.map((x) => k.num(x.received)),
                  tone: 1,
                },
              ],
              height: 160,
            }),
          )
        : k.note('No messages in the last 30 days.'),
      k.num(d.totalMessages)
        ? k.section(
            'Message mix',
            k.card(
              k.segments({
                items: [
                  { label: 'Text', value: k.num(mix.text), tone: 0 },
                  { label: 'Photos', value: k.num(mix.image), tone: 1 },
                  { label: 'Voice', value: k.num(mix.audio), tone: 2 },
                  { label: 'FinAI', value: k.num(mix.ai), tone: 3 },
                ].filter((x) => x.value > 0),
                format: 'number',
                title: 'Message mix',
              }),
            ),
          )
        : '',
      k.section(
        'Shared groups',
        groups.length
          ? k.list(groups.map((g) => k.row({ lead: k.glyph(g.name, g.icon), title: g.name })))
          : k.muted('No shared groups'),
      ),
      k.kv([
        d.friendsSince ? ['Friends since', k.date(d.friendsSince, 'day')] : null,
        d.conversationSince ? ['Chatting since', k.date(d.conversationSince, 'day')] : null,
        d.active === true
          ? ['Status', 'Active now']
          : d.lastSeenAt
            ? ['Last seen', k.ago(d.lastSeenAt)]
            : null,
      ]),
    );
  },
});

// ---------- finapp.personal.sessions.list ----------

type Session = {
  id: string;
  current: boolean;
  label: string;
  platform: 'web' | 'ios' | 'android' | string;
  signedInAt: number;
  lastSeenAt: number;
};

export const sessions = defineWidget<{ items?: Session[] }>({
  domain: 'security',
  name: 'sessions',
  title: 'Signed-in devices',
  description:
    'Every device signed in to your account, this one first, with when each was last used.',
  invoking: 'Checking your devices…',
  invoked: 'Devices ready',
  examples: [
    {
      items: [
        {
          id: 's1',
          current: true,
          label: 'Chrome on Windows',
          platform: 'web',
          signedInAt: daysAgo(12),
          lastSeenAt: daysAgo(0),
        },
        {
          id: 's2',
          current: false,
          label: 'Pixel 8',
          platform: 'android',
          signedInAt: daysAgo(40),
          lastSeenAt: daysAgo(0.3),
        },
        {
          id: 's3',
          current: false,
          label: 'Safari on Mac',
          platform: 'web',
          signedInAt: daysAgo(95),
          lastSeenAt: daysAgo(33),
        },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const rows = k.arr(d.items);
    if (!rows.length)
      return k.page(
        k.header('Security', 'Signed-in devices'),
        k.empty('No devices found', undefined, 'device'),
      );
    const stale = rows.filter(
      (r) => !r.current && Date.now() - k.num(r.lastSeenAt) > 30 * 86_400_000,
    ).length;
    return k.page(
      k.header('Security', 'Signed-in devices', k.pill(rows.length + ' signed in', 'info')),
      k.list(
        rows.map((r) =>
          k.row({
            lead: k.tile(
              k.icon(r.platform === 'web' ? 'laptop' : 'device'),
              r.current ? 'accent' : 'muted',
            ),
            title: r.label,
            sub: (r.current ? 'This device · ' : '') + 'Signed in ' + k.date(r.signedInAt, 'day'),
            value: r.current ? 'Now' : k.ago(r.lastSeenAt),
            valueSub: 'last used',
            badge: r.current ? 'This device' : undefined,
          }),
        ),
      ),
      stale
        ? k.notice(
            stale +
              ' device' +
              (stale === 1 ? ' hasn’t' : 's haven’t') +
              ' been used in over a month. Sign them out in Finapp → Settings → Security.',
            'warn',
            'shield',
          )
        : k.note('Sign devices out in Finapp → Settings → Security.'),
    );
  },
});

// ---------- finapp.personal.notifications.summary ----------

type NotificationState = {
  unreadCount: number;
  unreadCapped?: boolean;
  preferences: Record<string, boolean>;
};

export const notificationStatus = defineWidget<NotificationState>({
  domain: 'notifications',
  name: 'status',
  title: 'Notification status',
  description: 'Your unread notification count and which kinds of notifications are on.',
  invoking: 'Checking notifications…',
  invoked: 'Notifications ready',
  examples: [
    {
      unreadCount: 7,
      unreadCapped: false,
      preferences: {
        transaction: true,
        budget: true,
        goal: true,
        recurring: true,
        group: true,
        split: true,
        settlement: true,
        social: true,
        security: true,
        sync: false,
      },
    },
  ],
  empty: { unreadCount: 0, preferences: {} },
  render: (d, k) => {
    const labels: Record<string, [string, string]> = {
      transaction: ['Transactions', 'New and edited transactions'],
      budget: ['Category limits', 'Alerts when a category nears or passes its limit'],
      goal: ['Goals', 'Milestones and contributions'],
      recurring: ['Recurring', 'Upcoming and posted bills'],
      group: ['Groups', 'Invites, members and group activity'],
      split: ['Splits', 'Expenses shared with you'],
      settlement: ['Settlements', 'Payments recorded and reminders'],
      social: ['Friends', 'Friend requests and messages'],
      security: ['Security', 'New sign-ins and account changes'],
      sync: ['Sync', 'Sync problems on your devices'],
    };
    const prefs = d.preferences || {};
    const keys = Object.keys(prefs);
    const on = keys.filter((key) => prefs[key]).length;
    const unread = k.num(d.unreadCount);
    if (!unread && !keys.length)
      return k.page(
        k.header('Notifications', 'Status'),
        k.empty('You’re all caught up', 'No unread notifications.', 'bell'),
      );
    return k.page(
      k.header('Notifications', 'Status'),
      k.hero({
        label: 'Unread',
        value: k.number(unread) + (d.unreadCapped ? '+' : ''),
        tone: unread ? 'accent' : 'muted',
        sub: unread ? 'Open Finapp to catch up.' : 'You’re all caught up.',
      }),
      keys.length
        ? k.section(
            'Notifications on',
            k.card(
              keys
                .map((key) => {
                  const meta = labels[key] || [key, ''];
                  return k.toggle(Boolean(prefs[key]), meta[0], meta[1]);
                })
                .join(''),
            ),
            on + ' of ' + keys.length,
          )
        : '',
    );
  },
});

// ---------- finapp.personal.finai_settings.get ----------

type FinaiSettings = {
  enabled: boolean;
  tone: string;
  length: string;
  language: string;
  customInstructions?: string;
  aboutMe?: string;
  useEmoji?: boolean;
  dataScopes?: Record<string, boolean>;
  allowActions?: boolean;
  allowChatMentions?: boolean;
  autoCategorizeReceipts?: boolean;
  showSteps?: boolean;
  showLauncher?: boolean;
  allowAttachments?: boolean;
  attachmentRetention?: string;
};

export const finaiSettings = defineWidget<FinaiSettings>({
  domain: 'finai',
  name: 'settings',
  title: 'FinAI settings',
  description: 'How FinAI is set up: on or off, tone, length, language, what it can read and do.',
  invoking: 'Reading FinAI settings…',
  invoked: 'FinAI settings ready',
  examples: [
    {
      enabled: true,
      tone: 'friendly',
      length: 'balanced',
      language: 'auto',
      customInstructions: 'Keep amounts in rupees and round to the nearest hundred.',
      aboutMe: 'Student, paid monthly.',
      useEmoji: true,
      dataScopes: { money: true, planning: true, groups: true, people: false },
      allowActions: true,
      allowChatMentions: true,
      autoCategorizeReceipts: true,
      showSteps: true,
      showLauncher: true,
      allowAttachments: true,
      attachmentRetention: '24h',
    },
  ],
  empty: {} as FinaiSettings,
  render: (d, k) => {
    if (!d || !d.tone)
      return k.page(
        k.header('FinAI', 'Settings'),
        k.empty(
          'Settings unavailable',
          'Sign in to Finapp to see your FinAI settings.',
          'spark',
        ),
      );
    const cap = (s: unknown) => {
      const t = k.str(s);
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—';
    };
    const scopeNames: Record<string, string> = {
      money: 'Money',
      planning: 'Limits & goals',
      groups: 'Groups',
      people: 'People',
    };
    const retention: Record<string, string> = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      never: 'Never',
    };
    const scopes = d.dataScopes || {};
    return k.page(
      k.header('FinAI', 'Settings', d.enabled ? k.pill('On', 'income') : k.pill('Off', 'muted')),
      !d.enabled
        ? k.notice('FinAI is turned off. Turn it on in Finapp → Settings → AI.', 'warn', 'spark')
        : '',
      k.kv([
        ['Tone', cap(d.tone)],
        ['Answer length', cap(d.length)],
        ['Language', d.language === 'auto' ? 'Same as you' : cap(d.language)],
        ['Emoji', d.useEmoji ? 'Yes' : 'No'],
        d.attachmentRetention
          ? ['Attachments kept', retention[d.attachmentRetention] || d.attachmentRetention]
          : null,
      ]),
      Object.keys(scopes).length
        ? k.section(
            'What FinAI can read',
            Object.keys(scopes)
              .map((key) => k.pill(scopeNames[key] || key, scopes[key] ? 'accent' : 'muted'))
              .join(' '),
          )
        : '',
      k.section(
        'What FinAI can do',
        k.card(
          [
            k.toggle(
              Boolean(d.allowActions),
              'Prepare changes',
              'Confirm-first cards for transactions and more',
            ),
            k.toggle(Boolean(d.allowChatMentions), 'Answer @finai in chats'),
            k.toggle(Boolean(d.autoCategorizeReceipts), 'Categorise receipts'),
            k.toggle(Boolean(d.allowAttachments), 'Read attachments'),
            k.toggle(Boolean(d.showLauncher), 'Floating button'),
            k.toggle(Boolean(d.showSteps), 'Show steps'),
          ].join(''),
        ),
      ),
      d.aboutMe ? k.section('About you', k.text(d.aboutMe)) : '',
      d.customInstructions ? k.section('Custom instructions', k.text(d.customInstructions)) : '',
    );
  },
});

// ---------- finapp.finance.category_limits.list ----------

type LimitRow = {
  categoryId: string;
  name: string;
  icon?: string;
  color?: string;
  currency: string;
  limitMinor: Minor;
  spentMinor: Minor;
  remainingMinor: Minor;
  percentUsed: number;
  alertPercent: number;
  status: 'normal' | 'warning' | 'near-limit' | 'exceeded' | string;
  startAt?: number;
  endAt?: number;
};

export const categoryLimitUsage = defineWidget<{ items?: LimitRow[] }>({
  domain: 'categories',
  name: 'limitUsage',
  title: 'Category limits',
  description: 'This month’s spending against each category limit (its budget), over-limit first.',
  invoking: 'Checking your category limits…',
  invoked: 'Category limits ready',
  examples: [
    {
      items: [
        ['Food & dining', '🍔', 1_200_000, 845_000, 80],
        ['Transport', '🚕', 400_000, 436_500, 80],
        ['Shopping', '🛍️', 800_000, 690_000, 85],
        ['Entertainment', '🎬', 300_000, 90_000, 80],
      ].map(([name, icon, limit, spent, alert], i) => ({
        categoryId: 'c' + i,
        name: name as string,
        icon: icon as string,
        currency: CUR,
        limitMinor: limit as number,
        spentMinor: spent as number,
        remainingMinor: (limit as number) - (spent as number),
        percentUsed: Math.round(((spent as number) / (limit as number)) * 10000) / 100,
        alertPercent: alert as number,
        status:
          (spent as number) > (limit as number)
            ? 'exceeded'
            : (spent as number) / (limit as number) >= 0.9
              ? 'near-limit'
              : (spent as number) / (limit as number) >= (alert as number) / 100
                ? 'warning'
                : 'normal',
        startAt: daysAgo(25),
        endAt: daysAgo(-5),
      })),
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const rows = k
      .arr(d.items)
      .slice()
      .sort((a, b) => k.num(b.percentUsed) - k.num(a.percentUsed));
    if (!rows.length)
      return k.page(
        k.header('Categories', 'Category limits'),
        k.empty('No limits yet', 'Set a monthly limit on a category to track it here.', 'target'),
      );
    const over = rows.filter((r) => r.status === 'exceeded').length;
    const atRisk = rows.filter((r) => r.status === 'warning' || r.status === 'near-limit').length;
    const currency = rows[0]!.currency;
    const sameCurrency = rows.every((r) => r.currency === currency);
    const first = rows[0]!;
    return k.page(
      k.header(
        'This month',
        'Category limits',
        over
          ? k.pill(over + ' over', 'expense')
          : atRisk
            ? k.pill(atRisk + ' at risk', 'warn')
            : k.pill('On track', 'income'),
      ),
      sameCurrency
        ? k.stats([
            {
              label: 'Limits',
              value: k.money(k.sum(rows.map((r) => k.num(r.limitMinor))), currency),
            },
            {
              label: 'Spent',
              value: k.money(k.sum(rows.map((r) => k.num(r.spentMinor))), currency),
              tone: 'expense',
            },
            { label: 'Over limit', value: k.number(over), tone: over ? 'expense' : null },
          ])
        : '',
      k.card(
        rows
          .map((r) =>
            k.meter({
              lead: k.glyph(r.name, r.icon),
              label: r.name,
              value: k.num(r.spentMinor),
              max: k.num(r.limitMinor),
              warnAt: k.num(r.alertPercent) / 100 || 0.8,
              valueText: k.amount(r, 'spent'),
              maxText: k.amount(r, 'limit'),
              sub:
                k.num(r.remainingMinor) < 0
                  ? k.amount(r, 'remaining').replace(/^[−-]/, '') + ' over'
                  : k.amount(r, 'remaining') + ' left',
            }),
          )
          .join(''),
      ),
      first.startAt && first.endAt
        ? k.note(
            'Resets ' +
              k.date(first.endAt, 'day') +
              '. Alerts fire at each category’s alert level and at 100%.',
          )
        : '',
    );
  },
});

export const linkedWidgets = [
  inbox,
  personAnalytics,
  sessions,
  notificationStatus,
  finaiSettings,
  categoryLimitUsage,
];
