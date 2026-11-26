import { presentMoney } from './money';
import type { WidgetId } from './toolkit';
import { widgetHtml, widgets } from './widgets';

const DAY = 86_400_000;

/** Fictional sample results shown in the dashboard's widget previews (no user data). */
function samples(now: number): Record<WidgetId, { toolName: string; data: unknown }> {
  const alex = 'preview-alex';
  const sam = 'preview-sam';
  const you = 'preview-you';
  const groupBase = {
    group: { id: 'preview-group', name: 'Goa trip', currency: 'INR', role: 'admin' },
    currency: 'INR',
    status: 'ready',
    meId: you,
  };
  return {
    overview: {
      toolName: 'finapp.finance.overview',
      data: {
        period: { startAt: now - 30 * DAY, endAt: now },
        currency: 'INR',
        incomeMinor: 9_500_000n,
        spentMinor: 4_218_050n,
        netMinor: 5_281_950n,
        spendingTrend: [820, 1460, 640, 2210, 980, 1750, 1120, 1600],
        totals: [{ currency: 'INR', balanceMinor: 18_742_300n }],
        accounts: [
          {
            id: 'a1',
            name: 'HDFC Savings',
            type: 'bank',
            currency: 'INR',
            balanceMinor: 15_420_000n,
            isIncludedInTotal: true,
          },
          {
            id: 'a2',
            name: 'Cash',
            type: 'cash',
            currency: 'INR',
            balanceMinor: 322_300n,
            isIncludedInTotal: true,
          },
          {
            id: 'a3',
            name: 'Credit card',
            type: 'card',
            currency: 'INR',
            balanceMinor: 3_000_000n,
            isIncludedInTotal: true,
          },
        ],
        categoryLimits: [
          {
            categoryId: 'c1',
            name: 'Food & dining',
            currency: 'INR',
            limitMinor: 1_200_000n,
            spentMinor: 845_000n,
            remainingMinor: 355_000n,
            progress: 0.704,
          },
          {
            categoryId: 'c2',
            name: 'Transport',
            currency: 'INR',
            limitMinor: 400_000n,
            spentMinor: 436_500n,
            remainingMinor: -36_500n,
            progress: 1.091,
          },
        ],
        recent: [
          {
            id: 'r1',
            title: 'Blue Tokai',
            type: 'expense',
            amountMinor: 42_000n,
            currency: 'INR',
            occurredAt: now - DAY,
          },
          {
            id: 'r2',
            title: 'Salary',
            type: 'income',
            amountMinor: 9_500_000n,
            currency: 'INR',
            occurredAt: now - 3 * DAY,
          },
        ],
      },
    },
    transactions: {
      toolName: 'finapp.finance.transactions.list',
      data: {
        items: [
          {
            id: 't1',
            title: 'Big Basket',
            type: 'expense',
            amountMinor: 186_000n,
            currency: 'INR',
            merchant: 'BigBasket',
            occurredAt: now - DAY,
            items: [
              { id: 'i1', title: 'Coffee beans', amountMinor: 96_000n, quantity: 2 },
              { id: 'i2', title: 'Oat milk', amountMinor: 54_000n, quantity: 3 },
              { id: 'i3', title: 'Bananas', amountMinor: 36_000n },
            ],
          },
          {
            id: 't2',
            title: 'Uber to airport',
            type: 'expense',
            amountMinor: 74_350n,
            currency: 'INR',
            merchant: 'Uber',
            occurredAt: now - 2 * DAY,
          },
          {
            id: 't3',
            title: 'Refund — headphones',
            type: 'refund',
            amountMinor: 549_900n,
            currency: 'INR',
            occurredAt: now - 4 * DAY,
          },
        ],
        nextCursor: 'preview',
        isDone: false,
      },
    },
    groupBalances: {
      toolName: 'finapp.groups.balances',
      data: {
        ...groupBase,
        myBalanceMinor: 345_000n,
        members: [
          { userId: you, displayName: 'You', current: true, amountMinor: 345_000n, isMe: true },
          { userId: sam, displayName: 'Sam', current: true, amountMinor: -120_000n, isMe: false },
          { userId: alex, displayName: 'Alex', current: true, amountMinor: -225_000n, isMe: false },
        ],
        transfers: [
          {
            fromUserId: alex,
            fromName: 'Alex',
            toUserId: you,
            toName: 'You',
            amountMinor: 225_000n,
            direction: 'you_receive',
          },
          {
            fromUserId: sam,
            fromName: 'Sam',
            toUserId: you,
            toName: 'You',
            amountMinor: 120_000n,
            direction: 'you_receive',
          },
        ],
      },
    },
    expense: {
      toolName: 'finapp.groups.expenses.get',
      data: {
        id: 'preview-expense',
        title: 'Beach shack dinner',
        type: 'expense',
        status: 'posted',
        amountMinor: 360_000n,
        currency: 'INR',
        occurredAt: now - 2 * DAY,
        merchant: 'Curlies',
        createdById: you,
        createdByName: 'You',
        deleted: false,
        items: [
          { id: 'e1', title: 'Prawn curry', amountMinor: 180_000n, participantIds: [you, alex] },
          { id: 'e2', title: 'Veg thali', amountMinor: 90_000n, participantIds: [sam] },
          { id: 'e3', title: 'Drinks', amountMinor: 90_000n },
        ],
        group: {
          id: 'preview-group',
          name: 'Goa trip',
          version: 2,
          payers: [{ userId: you, displayName: 'You', amountMinor: 360_000n }],
          participants: [
            { userId: you, displayName: 'You', amountMinor: 120_000n, method: 'itemized' },
            { userId: alex, displayName: 'Alex', amountMinor: 120_000n, method: 'itemized' },
            { userId: sam, displayName: 'Sam', amountMinor: 120_000n, method: 'itemized' },
          ],
        },
      },
    },
    settleUp: {
      toolName: 'finapp.groups.settle_up.prepare',
      data: {
        ...groupBase,
        myBalanceMinor: -150_000n,
        members: [],
        transfers: [
          {
            fromUserId: you,
            fromName: 'You',
            toUserId: alex,
            toName: 'Alex',
            amountMinor: 150_000n,
            direction: 'you_pay',
          },
        ],
        accounts: [
          { id: 'a1', name: 'HDFC Savings', currency: 'INR', balanceMinor: 15_420_000n },
          { id: 'a2', name: 'Cash', currency: 'INR', balanceMinor: 322_300n },
        ],
      },
    },
  };
}

export function widgetPreviews(now = Date.now()) {
  const data = samples(now);
  return (Object.keys(widgets) as WidgetId[]).map((id) => ({
    id,
    title: widgets[id].title,
    description: widgets[id].description,
    toolName: data[id].toolName,
    html: widgetHtml(id),
    sample: presentMoney(data[id].data),
  }));
}
