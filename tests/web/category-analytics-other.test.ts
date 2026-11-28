import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategoryAnalyticsScreen } from '@finapp/ui/finance';
import { ThemeProvider } from '@finapp/ui/web';

const categories = Array.from({ length: 7 }, (_, index) => ({
  id: `category-${index + 1}`,
  name: `Category ${index + 1}`,
  kind: 'expense' as const,
  currency: 'USD',
}));

function renderScreen() {
  const now = new Date();
  const currentMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10);
  const previousMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10);
  const transactions = categories.flatMap((category, index) =>
    index === 6
      ? [
          {
            id: `${category.id}-current`,
            categoryId: category.id,
            amountMinor: 10n,
            currency: 'USD',
            type: 'expense',
            title: category.name,
            occurredAt: currentMonth,
            status: 'posted',
          },
          {
            id: `${category.id}-previous`,
            categoryId: category.id,
            amountMinor: 20n,
            currency: 'USD',
            type: 'expense',
            title: category.name,
            occurredAt: previousMonth,
            status: 'posted',
          },
        ]
      : [
          {
            id: `${category.id}-current`,
            categoryId: category.id,
            amountMinor: BigInt(1000 - index * 100),
            currency: 'USD',
            type: 'expense',
            title: category.name,
            occurredAt: currentMonth,
            status: 'posted',
          },
        ],
  );

  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(CategoryAnalyticsScreen, {
        categories,
        accounts: [],
        transactions,
        defaultCurrency: 'USD',
        onOpenCategory: () => undefined,
      }),
    ),
  );
}

describe('monthly category chart', () => {
  it('aggregates omitted categories into Other separately for each month', () => {
    const markup = renderScreen();

    expect(markup).toContain('Other');
    expect(markup).toContain('$0.10');
    expect(markup).toContain('$0.20');
  });
});
