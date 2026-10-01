export type GoalTrendMonth = { label: string; amount: bigint };
export type GoalAnalyticsContribution = {
  id: string;
  occurredAt: number;
  amount: bigint;
  accountId?: string;
};
export type GoalAnalyticsAccount = { id: string; name: string; color?: string; icon?: string };
export type GoalAnalyticsSource = GoalAnalyticsAccount & { amount: bigint; sharePercent: number };
export type GoalMilestone = {
  percent: 25 | 50 | 75 | 100;
  amount: bigint;
  achievedAt?: number;
  projectedAt?: number;
};
export type GoalAnalyticsModel = {
  saved: bigint;
  target: bigint;
  remaining: bigint;
  percent: number;
  months: readonly GoalTrendMonth[];
  averageMonthly: bigint | null;
  bestMonth: GoalTrendMonth | null;
  forecastDate: number | null;
  requiredMonthly: bigint | null;
  onTrackScore: number | null;
  sources: readonly GoalAnalyticsSource[];
  milestones: readonly GoalMilestone[];
};
export type GoalAnalyticsInput = {
  contributions: readonly GoalAnalyticsContribution[];
  accounts: readonly GoalAnalyticsAccount[];
  target: bigint;
  targetDate?: number;
  createdAt?: number;
  now: number;
};

function addMonthsClamped(timestamp: number, months: number): number {
  const date = new Date(timestamp);
  const desiredDay = date.getDate();
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(desiredDay, lastDay));
  targetMonth.setHours(
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  return targetMonth.getTime();
}

export function buildGoalAnalyticsModel({
  contributions,
  accounts,
  target,
  targetDate,
  createdAt,
  now,
}: GoalAnalyticsInput): GoalAnalyticsModel {
  const ordered = [...contributions].sort((left, right) => left.occurredAt - right.occurredAt);
  const saved = ordered.reduce((sum, contribution) => sum + contribution.amount, 0n);
  const remaining = target > saved ? target - saved : 0n;
  const percent = target > 0n ? Number((saved * 100n) / target) : 0;
  const currentDate = new Date(now);
  const creationDate =
    createdAt === undefined
      ? new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1)
      : new Date(createdAt);
  const monthsSinceCreation =
    (currentDate.getFullYear() - creationDate.getFullYear()) * 12 +
    currentDate.getMonth() -
    creationDate.getMonth() +
    1;
  const observedMonths = Math.min(6, Math.max(1, monthsSinceCreation));
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
    const from = date.getTime();
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
    const amount = ordered
      .filter((contribution) => contribution.occurredAt >= from && contribution.occurredAt < to)
      .reduce((sum, contribution) => sum + contribution.amount, 0n);
    return { label: date.toLocaleDateString(undefined, { month: 'short' }), amount };
  });
  const observedTrend = months.slice(6 - observedMonths);
  const averageMonthly =
    ordered.length > 0
      ? observedTrend.reduce((sum, month) => sum + month.amount, 0n) / BigInt(observedMonths)
      : null;
  const bestMonth =
    ordered.length > 0
      ? observedTrend.reduce<GoalTrendMonth | null>(
          (best, month) => (best === null || month.amount > best.amount ? month : best),
          null,
        )
      : null;
  const forecastMonths =
    remaining > 0n && averageMonthly && averageMonthly > 0n
      ? Number((remaining + averageMonthly - 1n) / averageMonthly)
      : null;
  let goalAchievedAt: number | undefined;
  let cumulativeSaved = 0n;
  if (target > 0n) {
    for (const contribution of ordered) {
      cumulativeSaved += contribution.amount;
      if (cumulativeSaved >= target) {
        goalAchievedAt = contribution.occurredAt;
        break;
      }
    }
  }
  const monthsToTarget =
    targetDate !== undefined && targetDate > now
      ? Math.max(1, Math.ceil((targetDate - now) / (30 * 24 * 60 * 60 * 1000)))
      : null;
  const requiredMonthly =
    monthsToTarget === null || remaining === 0n
      ? null
      : (remaining + BigInt(monthsToTarget) - 1n) / BigInt(monthsToTarget);
  const onTrackScore =
    requiredMonthly === null || averageMonthly === null
      ? null
      : requiredMonthly === 0n
        ? 100
        : Math.min(100, Number((averageMonthly * 100n) / requiredMonthly));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const amountByAccount = new Map<string, bigint>();
  for (const contribution of ordered) {
    if (!contribution.accountId || !accountById.has(contribution.accountId)) continue;
    amountByAccount.set(
      contribution.accountId,
      (amountByAccount.get(contribution.accountId) ?? 0n) + contribution.amount,
    );
  }
  const sources = [...amountByAccount]
    .map(([id, amount]) => ({
      ...accountById.get(id)!,
      amount,
      sharePercent: saved > 0n ? Number((amount * 100n) / saved) : 0,
    }))
    .sort((left, right) =>
      left.amount === right.amount
        ? left.name.localeCompare(right.name)
        : left.amount > right.amount
          ? -1
          : 1,
    );
  const milestones = ([25, 50, 75, 100] as const).map((milestonePercent): GoalMilestone => {
    const amount = target > 0n ? (target * BigInt(milestonePercent) + 99n) / 100n : 0n;
    let cumulative = 0n;
    let achievedAt: number | undefined;
    for (const contribution of ordered) {
      cumulative += contribution.amount;
      if (cumulative >= amount) {
        achievedAt = contribution.occurredAt;
        break;
      }
    }
    const milestoneRemaining = amount > saved ? amount - saved : 0n;
    const projectedMonths =
      achievedAt === undefined && milestoneRemaining > 0n && averageMonthly && averageMonthly > 0n
        ? Number((milestoneRemaining + averageMonthly - 1n) / averageMonthly)
        : achievedAt === undefined && milestoneRemaining === 0n
          ? 0
          : null;
    return {
      percent: milestonePercent,
      amount,
      achievedAt,
      projectedAt: projectedMonths === null ? undefined : addMonthsClamped(now, projectedMonths),
    };
  });
  const forecastDate =
    remaining === 0n
      ? (goalAchievedAt ?? null)
      : forecastMonths === null
        ? null
        : addMonthsClamped(now, forecastMonths);
  return {
    saved,
    target,
    remaining,
    percent,
    months,
    averageMonthly,
    bestMonth,
    forecastDate,
    requiredMonthly,
    onTrackScore,
    sources,
    milestones,
  };
}

export type GoalAnalyticsPanelProps = {
  name: string;
  icon?: string;
  color?: string;
  currency: string;
  saved: bigint;
  target: bigint;
  remaining: bigint;
  percent: number;
  months: readonly GoalTrendMonth[];
  insights?: GoalAnalyticsModel;
  history?: readonly GoalAnalyticsContribution[];
  loading?: boolean;
  available?: boolean;
  error?: string;
  onBack?: () => void;
  onRetry?: () => void;
};
