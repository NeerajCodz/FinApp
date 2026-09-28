import type { HomeDashboardData } from './model';

export type HomePerson = {
  id: string;
  username?: string;
  name: string;
  image?: string | null;
  transactionCount: number;
  amountMinor: bigint;
};

export type HomeAccountOption = { id: string; name: string; currency: string };

export type HomeDashboardProps = {
  data: HomeDashboardData;
  people: readonly HomePerson[];
  peopleLoading: boolean;
  peopleError: boolean;
  accounts: readonly HomeAccountOption[];
  selectedAccountId: string;
  search: string;
  dateLabel: string;
  currency: string;
  onSearchChange: (value: string) => void;
  onAccountChange: (id: string) => void;
  onChooseDate: () => void;
  onOpenSync: () => void;
  onOpenTransaction: (id: string) => void;
  onSeeAllTransactions: () => void;
  onOpenBudget: (id: string) => void;
  onSeeAllBudgets: () => void;
  onOpenGoal: (id: string) => void;
  onSeeAllGoals: () => void;
  onOpenCategory: (id: string) => void;
  onSeeAllCategories: () => void;
  onOpenGroup: (id: string) => void;
  onSeeAllGroups: () => void;
  onOpenPerson: (username: string) => void;
  onSeeAllBills: () => void;
};
