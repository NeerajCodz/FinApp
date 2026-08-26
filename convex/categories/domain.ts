export type CategorySeed = {
  name: string;
  kind: 'expense' | 'income';
  isSystem: true;
  sortOrder: number;
};

const expenseNames = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills',
  'Health',
  'Education',
  'Travel',
  'Housing',
  'Personal',
  'Subscriptions',
  'Gifts',
  'Other',
];
const incomeNames = ['Salary', 'Freelance', 'Investment', 'Refund', 'Gift', 'Other'];

export function seedCategories(): CategorySeed[] {
  return [
    ...expenseNames.map((name, sortOrder) => ({
      name,
      kind: 'expense' as const,
      isSystem: true as const,
      sortOrder,
    })),
    ...incomeNames.map((name, sortOrder) => ({
      name,
      kind: 'income' as const,
      isSystem: true as const,
      sortOrder,
    })),
  ];
}

export function validateCategorySelection(category: { archivedAt?: number }): void {
  if (category.archivedAt !== undefined) throw new Error('INVALID_CATEGORY');
}
