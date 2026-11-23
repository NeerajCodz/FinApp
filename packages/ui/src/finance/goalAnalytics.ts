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

/** Loosely-typed synced records, as stored by the mobile and web offline repositories. */
type SyncedRecord = { id?: unknown; _id?: unknown; cloudId?: unknown; [key: string]: unknown };

export type GoalAnalyticsSelection = {
  name: string;
  icon?: string;
  color?: string;
  currency: string;
  available: boolean;
  /** Number of goals that contributed to the view (1 for a single goal). */
  goalCount: number;
  history: GoalAnalyticsContribution[];
  insights: GoalAnalyticsModel;
};

const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};

const recordAliases = (record: SyncedRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );

const primaryId = (record: SyncedRecord) => String(record.id ?? record._id ?? '');

/**
 * Builds analytics for one goal (`goalId`) or, when omitted, for every active goal
 * in the most common currency so totals are never summed across currencies.
 */
export function selectGoalAnalytics({
  goals,
  contributions,
  accounts,
  goalId,
  now,
  fallbackCurrency = 'INR',
}: {
  goals: readonly SyncedRecord[];
  contributions: readonly SyncedRecord[];
  accounts: readonly SyncedRecord[];
  goalId?: string;
  now: number;
  fallbackCurrency?: string;
}): GoalAnalyticsSelection {
  const active = goals.filter((goal) => goal.archivedAt === undefined);
  let selected: SyncedRecord[];
  let currency: string;
  if (goalId) {
    const goal = goals.find((item) => recordAliases(item).includes(goalId));
    selected = goal && goal.archivedAt === undefined ? [goal] : [];
    currency = typeof goal?.currency === 'string' ? goal.currency : fallbackCurrency;
  } else {
    const counts = new Map<string, number>();
    for (const goal of active) {
      const code = typeof goal.currency === 'string' ? goal.currency : fallbackCurrency;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    currency =
      [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallbackCurrency;
    selected = active.filter(
      (goal) => (typeof goal.currency === 'string' ? goal.currency : fallbackCurrency) === currency,
    );
  }
  const goalAliasSet = new Set(selected.flatMap(recordAliases));
  if (goalId && selected.length === 0) goalAliasSet.add(goalId);
  const accountIds = new Map(
    accounts.flatMap((account) =>
      recordAliases(account).map((alias) => [alias, primaryId(account)] as const),
    ),
  );
  const history: GoalAnalyticsContribution[] = contributions
    .filter((entry) => typeof entry.goalId === 'string' && goalAliasSet.has(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .map((entry) => ({
      id: primaryId(entry),
      occurredAt: Number(entry.occurredAt ?? 0),
      amount: toMinor(entry.amountMinor),
      accountId: typeof entry.accountId === 'string' ? accountIds.get(entry.accountId) : undefined,
    }));
  const single = goalId ? selected[0] : undefined;
  const targetDates = selected
    .map((goal) => goal.targetDate)
    .filter((value): value is number => typeof value === 'number');
  const createdDates = selected
    .map((goal) => goal.createdAt)
    .filter((value): value is number => typeof value === 'number');
  const insights = buildGoalAnalyticsModel({
    contributions: history,
    accounts: accounts
      .filter((account) => account.archivedAt === undefined)
      .map((account) => ({
        id: primaryId(account),
        name: typeof account.name === 'string' ? account.name : 'Account',
        color: typeof account.color === 'string' ? account.color : undefined,
        icon: typeof account.icon === 'string' ? account.icon : undefined,
      })),
    target: selected.reduce((sum, goal) => sum + toMinor(goal.targetAmountMinor), 0n),
    targetDate: targetDates.length ? Math.max(...targetDates) : undefined,
    createdAt: createdDates.length ? Math.min(...createdDates) : undefined,
    now,
  });
  return {
    name: goalId
      ? typeof single?.name === 'string'
        ? single.name
        : 'Savings goal'
      : selected.length === 1 && typeof selected[0]?.name === 'string'
        ? selected[0].name
        : 'All savings goals',
    icon: typeof single?.icon === 'string' ? single.icon : undefined,
    color: typeof single?.color === 'string' ? single.color : undefined,
    currency,
    available: selected.length > 0,
    goalCount: selected.length,
    history,
    insights,
  };
}
