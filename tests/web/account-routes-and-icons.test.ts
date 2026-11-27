import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountDetailView, AccountsIndexView, SuggestedTransfers } from '@finapp/ui/finance';
import { ThemeProvider } from '@finapp/ui/web';
import { matchesRouteId, routeIdFor } from '../../apps/web/app/(finance)/_personal';

const account = {
  id: 'local-4aaf2af9',
  name: 'Everyday account',
  type: 'bank',
  currency: 'USD',
  balanceMinor: 125_000n,
  icon: 'phosphor:wallet',
  color: '#5B8CFF',
  isIncludedInTotal: true,
} as const;

function renderWithTheme(element: React.ReactNode) {
  return renderToStaticMarkup(React.createElement(ThemeProvider, null, element));
}

describe('personal account routes', () => {
  it('omits the local marker from URLs while resolving both old and new paths', () => {
    expect(routeIdFor(account.id)).toBe('4aaf2af9');
    expect(routeIdFor('accounts-cloud-id')).toBe('accounts-cloud-id');
    expect(matchesRouteId(account, '4aaf2af9')).toBe(true);
    expect(matchesRouteId(account, account.id)).toBe(true);
  });
});
describe('suggested transfers', () => {
  it("keeps every signed-in user's transfer visible before limiting unrelated suggestions", () => {
    const markup = renderWithTheme(
      React.createElement(SuggestedTransfers, {
        transfers: [
          { fromUserId: 'me', toUserId: 'a', amountMinor: 100n },
          { fromUserId: 'b', toUserId: 'me', amountMinor: 200n },
          { fromUserId: 'c', toUserId: 'd', amountMinor: 300n },
          { fromUserId: 'e', toUserId: 'f', amountMinor: 400n },
        ],
        currency: 'USD',
        people: [
          { id: 'me', name: 'Me' },
          { id: 'a', name: 'Alex' },
          { id: 'b', name: 'Blair' },
          { id: 'c', name: 'Casey' },
          { id: 'd', name: 'Devon' },
          { id: 'e', name: 'Emery' },
          { id: 'f', name: 'Finley' },
        ],
        meId: 'me',
        limit: 1,
      }),
    );

    expect(markup).toContain('You pay');
    expect(markup).toContain('Blair pays');
    expect(markup).not.toContain('Casey pays');
    expect(markup).toContain('+2 more suggested');
  });
});


describe('account icons', () => {
  it('renders visible contrasting icons on both account list and detail surfaces', () => {
    const list = renderWithTheme(
      React.createElement(AccountsIndexView, {
        accounts: [account],
        totals: [{ currency: 'USD', amountMinor: account.balanceMinor }],
        loading: false,
        onRetry: () => {},
        onAddAccount: () => {},
        onOpenAccount: () => {},
      }),
    );
    const detail = renderWithTheme(
      React.createElement(AccountDetailView, {
        account,
        activity: [],
        flowActivity: [],
        isBusy: false,
        onEdit: () => {},
        onRename: async () => true,
        onArchive: async () => true,
        onSetIcon: () => {},
        onSetColor: () => {},
        onAddTransaction: () => {},
        onOpenTransaction: () => {},
      }),
    );

    for (const markup of [list, detail]) {
      expect(markup).toContain('<svg');
      expect(markup).toMatch(/(?:color|fill)="var\(--finapp-background\)"/);
    }
  });
  it('exposes account editing only for active accounts', () => {
    const baseProps = {
      account,
      activity: [],
      flowActivity: [],
      isBusy: false,
      onEdit: () => {},
      onRename: async () => true,
      onArchive: async () => true,
      onSetIcon: () => {},
      onSetColor: () => {},
      onAddTransaction: () => {},
      onOpenTransaction: () => {},
    };
    const active = renderWithTheme(React.createElement(AccountDetailView, baseProps));
    const archived = renderWithTheme(
      React.createElement(AccountDetailView, {
        ...baseProps,
        account: { ...account, archivedAt: Date.now() },
      }),
    );

    expect(active).toContain('Edit details');
    expect(archived).not.toContain('Edit details');
  });
});
