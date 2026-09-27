export const quickAddActions = [
  {
    label: 'Expense',
    description: 'Money you spent',
    route: '/transaction/new?type=expense',
  },
  {
    label: 'Income',
    description: 'Money you received',
    route: '/transaction/new?type=income',
  },
  {
    label: 'Transfer',
    description: 'Move between accounts',
    route: '/transaction/new?type=transfer',
  },
  {
    label: 'Split expense',
    description: 'Share with people',
    route: '/split/new',
  },
  {
    label: 'Settlement',
    description: 'Pay someone back',
    route: '/settle/new',
  },
] as const;
