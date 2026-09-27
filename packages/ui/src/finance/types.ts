export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
export type SemanticType = TransactionType | 'split' | 'settlement';
export type MoneySize = 'hero' | 'display' | 'body';

export const semanticLabels: Record<SemanticType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  split: 'Split',
  settlement: 'Settlement',
  refund: 'Refund',
  adjustment: 'Adjustment',
};
