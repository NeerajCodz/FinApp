export const quickAddActions = [
  { label: 'Expense', route: '/transaction/new?type=expense' },
  { label: 'Income', route: '/transaction/new?type=income' },
  { label: 'Transfer', route: '/transaction/new?type=transfer' },
  { label: 'Split expense', route: '/split/new' },
  { label: 'Settlement', route: '/settle/new' },
] as const;
