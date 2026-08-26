import type { ActivityRow } from '../activity/domain';

export type DashboardInput = {
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  owedToUserMinor: bigint;
  owesUserMinor: bigint;
  recentTransactions: ActivityRow[];
  goalProgress: number;
};

export function composeDashboard(input: DashboardInput) {
  return {
    availableBalanceMinor: input.openingBalanceMinor + input.incomeMinor - input.expenseMinor,
    currentPeriod: { incomeMinor: input.incomeMinor, spendingMinor: input.expenseMinor },
    owedToUserMinor: input.owedToUserMinor,
    owesUserMinor: input.owesUserMinor,
    recentTransactions: input.recentTransactions.slice(0, 10),
    goalProgress: Math.max(0, Math.min(100, input.goalProgress)),
  };
}
