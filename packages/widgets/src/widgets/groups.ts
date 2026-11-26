import { daysAgo } from '../sample';
import { defineWidget } from '../types';

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

export const groupWidgets = [expenseHistory];
