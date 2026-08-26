export function aggregateSpending(
  rows: readonly { category: string; amountMinor: bigint }[],
): Record<string, bigint> {
  const result: Record<string, bigint> = {};
  for (const row of rows.slice(0, 1000))
    result[row.category] = (result[row.category] ?? 0n) + row.amountMinor;
  return result;
}

type InsightInput = {
  currentFood: bigint;
  previousFood: bigint;
  budgetUsedPercent: number;
  recurringDue: number;
};

export function deterministicInsights(input: InsightInput): string[] {
  const insights: string[] = [];
  if (input.previousFood > 0n && input.currentFood > input.previousFood) {
    const percentage = Number(
      ((input.currentFood - input.previousFood) * 100n) / input.previousFood,
    );
    if (percentage >= 10)
      insights.push(`Food spending is up ${percentage}% versus the prior period.`);
  }
  if (input.budgetUsedPercent >= 100) insights.push('Budget is exceeded.');
  else if (input.budgetUsedPercent >= 90) insights.push('Budget is near its limit.');
  else if (input.budgetUsedPercent >= 75) insights.push('Budget is in its warning range.');
  if (input.recurringDue > 0)
    insights.push(`${input.recurringDue} recurring payments are due soon.`);
  return insights;
}
