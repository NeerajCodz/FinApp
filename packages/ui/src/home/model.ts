export type HomeRecord = Record<string, unknown> & {
  id?: string;
  _id?: string;
  cloudId?: string;
};

export type HomeBucket = {
  startAt: number;
  endAt: number;
  amountMinor: bigint;
  incomeMinor: bigint;
  label: string;
};

export type HomeTransactionItem = {
  id: string;
  title: string;
  category?: string;
  categoryIcon?: string;
  currency: string;
  amountMinor: bigint;
  type: string;
  status?: string;
  occurredAt: number;
  hasTime: boolean;
  timeZone?: string;
  groupId?: string;
};

export type HomeDashboardData = {
  balanceMinor: bigint;
  spentMinor: bigint;
  incomeMinor: bigint;
  netMinor: bigint;
  upcomingBillsMinor: bigint;
  upcomingBillsCount: number;
  cashFlow: HomeBucket[];
  cashFlowRanges: { week: HomeBucket[]; month: HomeBucket[]; year: HomeBucket[] };
  budgets: Array<{
    id: string;
    name: string;
    spentMinor: bigint;
    amountMinor: bigint;
    currency: string;
  }>;
  upcomingBills: Array<{
    id: string;
    name: string;
    amountMinor: bigint;
    currency: string;
    nextOccurrence: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    savedMinor: bigint;
    targetMinor: bigint;
    currency: string;
    targetDate?: number;
  }>;
  categories: Array<{ id: string; name: string; icon?: string; amountMinor: bigint }>;
  groups: Array<{
    id: string;
    name: string;
    currency: string;
    memberCount: number;
    spentMinor: bigint;
  }>;
  transactions: HomeTransactionItem[];
};

export type HomeDashboardInput = {
  now: number;
  startAt: number;
  endAt: number;
  currency: string;
  timeZone?: string;
  accountId?: string;
  search?: string;
  accounts: readonly HomeRecord[];
  transactions: readonly HomeRecord[];
  categories: readonly HomeRecord[];
  groups: readonly HomeRecord[];
  groupMembers: readonly HomeRecord[];
  budgets: readonly HomeRecord[];
  recurringRules: readonly HomeRecord[];
  goals: readonly HomeRecord[];
  goalContributions: readonly HomeRecord[];
};

function recordId(record: HomeRecord): string {
  return String(record.id ?? record._id ?? record.cloudId ?? '');
}

function aliases(record: HomeRecord): string[] {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function amount(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function hasAlias(record: HomeRecord, value: unknown): boolean {
  return typeof value === 'string' && aliases(record).includes(value);
}

function isPosted(transaction: HomeRecord): boolean {
  return transaction.status === 'posted' && transaction.deletedAt === undefined;
}

function dailyCashFlowBuckets(start: Date, count: number, label: 'weekday' | 'day'): HomeBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const bucketStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      startAt: bucketStart.getTime(),
      endAt: new Date(
        bucketStart.getFullYear(),
        bucketStart.getMonth(),
        bucketStart.getDate() + 1,
      ).getTime(),
      amountMinor: 0n,
      incomeMinor: 0n,
      label:
        label === 'weekday'
          ? bucketStart.toLocaleDateString(undefined, { weekday: 'short' })
          : String(bucketStart.getDate()),
    };
  });
}

function addCashFlowTransaction(bucket: HomeBucket | undefined, transaction: HomeRecord) {
  if (!bucket) return;
  if (transaction.type === 'expense') bucket.amountMinor += amount(transaction.amountMinor);
  if (transaction.type === 'income') bucket.incomeMinor += amount(transaction.amountMinor);
}

export function buildHomeDashboard(input: HomeDashboardInput): HomeDashboardData {
  const selectedAccounts = input.accounts.filter(
    (account) =>
      account.currency === input.currency &&
      account.archivedAt === undefined &&
      (input.accountId ? hasAlias(account, input.accountId) : account.isIncludedInTotal !== false),
  );
  const selectedAccountAliases = new Set(selectedAccounts.flatMap(aliases));
  const transactions = input.transactions.filter(
    (transaction) =>
      transaction.currency === input.currency &&
      (!input.accountId ||
        selectedAccountAliases.has(String(transaction.accountId ?? '')) ||
        (transaction.type === 'transfer' &&
          selectedAccountAliases.has(String(transaction.transferAccountId ?? '')))),
  );
  const periodTransactions = transactions.filter(
    (transaction) =>
      isPosted(transaction) &&
      typeof transaction.occurredAt === 'number' &&
      transaction.occurredAt >= input.startAt &&
      transaction.occurredAt < input.endAt,
  );

  let balanceMinor = selectedAccounts.reduce(
    (total, account) => total + amount(account.balanceMinor ?? account.openingBalanceMinor),
    0n,
  );
  for (const transaction of transactions) {
    if (typeof transaction.clientUpdatedAt !== 'number' || !isPosted(transaction)) continue;
    const sourceSelected = selectedAccountAliases.has(String(transaction.accountId ?? ''));
    const destinationSelected =
      transaction.type === 'transfer' &&
      selectedAccountAliases.has(String(transaction.transferAccountId ?? ''));
    if (!sourceSelected && !destinationSelected) continue;
    const transactionAmount = amount(transaction.amountMinor);
    if (sourceSelected)
      balanceMinor +=
        transaction.type === 'expense' || transaction.type === 'transfer'
          ? -transactionAmount
          : transactionAmount;
    if (destinationSelected) balanceMinor += transactionAmount;
  }

  const categoryByAlias = new Map<string, HomeRecord>();
  for (const category of input.categories)
    for (const key of aliases(category)) categoryByAlias.set(key, category);
  let spentMinor = 0n;
  let incomeMinor = 0n;
  const categoryTotals = new Map<string, { name: string; icon?: string; amountMinor: bigint }>();
  for (const transaction of periodTransactions) {
    if (transaction.type === 'expense') {
      const value = amount(transaction.amountMinor);
      spentMinor += value;
      const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
      const id = category ? recordId(category) : '__uncategorized__';
      const total = categoryTotals.get(id) ?? {
        name: typeof category?.name === 'string' ? category.name : 'Uncategorized',
        icon: typeof category?.icon === 'string' ? category.icon : undefined,
        amountMinor: 0n,
      };
      total.amountMinor += value;
      categoryTotals.set(id, total);
    } else if (transaction.type === 'income') incomeMinor += amount(transaction.amountMinor);
  }

  const now = new Date(input.now);
  const year = now.getFullYear();
  const month = now.getMonth();
  const cashFlow: HomeBucket[] = Array.from({ length: 12 }, (_, monthIndex) => ({
    startAt: new Date(year, monthIndex, 1).getTime(),
    endAt: new Date(year, monthIndex + 1, 1).getTime(),
    amountMinor: 0n,
    incomeMinor: 0n,
    label: new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'short' }),
  }));
  const monthStart = new Date(year, month, 1);
  const weekStart = new Date(year, month, now.getDate() - now.getDay());
  const monthCashFlow = dailyCashFlowBuckets(
    monthStart,
    new Date(year, month + 1, 0).getDate(),
    'day',
  );
  const weekCashFlow = dailyCashFlowBuckets(weekStart, 7, 'weekday');
  const weekStartDay = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  for (const transaction of transactions) {
    if (!isPosted(transaction) || typeof transaction.occurredAt !== 'number') continue;
    const date = new Date(transaction.occurredAt);
    if (date.getFullYear() === year) addCashFlowTransaction(cashFlow[date.getMonth()], transaction);
    const dayIndex = Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - weekStartDay) / 86_400_000,
    );
    addCashFlowTransaction(weekCashFlow[dayIndex], transaction);
    if (date.getFullYear() === year && date.getMonth() === month)
      addCashFlowTransaction(monthCashFlow[date.getDate() - 1], transaction);
  }

  const accountByAlias = new Map<string, HomeRecord>();
  for (const account of input.accounts)
    for (const key of aliases(account)) accountByAlias.set(key, account);
  const budgetRecords = input.budgets
    .filter((budget) => {
      if (
        budget.archivedAt !== undefined ||
        (budget.currency ?? input.currency) !== input.currency ||
        Number(budget.startAt ?? 0) > input.now ||
        Number(budget.endAt ?? 0) <= input.now
      )
        return false;
      if (!input.accountId || !budget.accountId) return true;
      const budgetAccount = accountByAlias.get(String(budget.accountId));
      return Boolean(budgetAccount && hasAlias(budgetAccount, input.accountId));
    })
    .map((budget) => {
      const spent = transactions.reduce((total, transaction) => {
        const occurredAt = Number(transaction.occurredAt ?? 0);
        if (
          !isPosted(transaction) ||
          transaction.type !== 'expense' ||
          occurredAt < Number(budget.startAt ?? 0) ||
          occurredAt >= Number(budget.endAt ?? Number.MAX_SAFE_INTEGER)
        )
          return total;
        if (budget.period === 'category') {
          const budgetCategory = categoryByAlias.get(String(budget.categoryId ?? ''));
          const transactionCategory = categoryByAlias.get(String(transaction.categoryId ?? ''));
          if (
            !budgetCategory ||
            !transactionCategory ||
            recordId(budgetCategory) !== recordId(transactionCategory)
          )
            return total;
        }
        if (budget.period === 'account') {
          const budgetAccount = accountByAlias.get(String(budget.accountId ?? ''));
          const transactionAccount = accountByAlias.get(String(transaction.accountId ?? ''));
          if (
            !budgetAccount ||
            !transactionAccount ||
            recordId(budgetAccount) !== recordId(transactionAccount)
          )
            return total;
        }
        return total + amount(transaction.amountMinor);
      }, 0n);
      return {
        id: recordId(budget),
        name: typeof budget.name === 'string' ? budget.name : 'Budget',
        spentMinor: spent,
        amountMinor: amount(budget.amountMinor),
        currency: typeof budget.currency === 'string' ? budget.currency : input.currency,
      };
    })
    .sort((left, right) => {
      const leftPercent =
        left.amountMinor > 0n ? Number((left.spentMinor * 100n) / left.amountMinor) : 0;
      const rightPercent =
        right.amountMinor > 0n ? Number((right.spentMinor * 100n) / right.amountMinor) : 0;
      return rightPercent - leftPercent;
    })
    .slice(0, 3);

  const upcomingRules = input.recurringRules
    .filter((rule) => {
      const template =
        rule.template && typeof rule.template === 'object' ? (rule.template as HomeRecord) : {};
      const nextOccurrence = Number(rule.nextOccurrence ?? 0);
      return (
        rule.enabled === true &&
        template.type === 'expense' &&
        nextOccurrence >= input.now &&
        nextOccurrence < input.now + 30 * 86_400_000 &&
        (template.currency ??
          accountByAlias.get(String(template.accountId ?? ''))?.currency ??
          input.currency) === input.currency &&
        (!input.accountId ||
          !template.accountId ||
          selectedAccountAliases.has(String(template.accountId)))
      );
    })
    .sort((left, right) => Number(left.nextOccurrence ?? 0) - Number(right.nextOccurrence ?? 0));
  const upcomingBills = upcomingRules.slice(0, 4).map((rule) => {
    const template =
      rule.template && typeof rule.template === 'object' ? (rule.template as HomeRecord) : {};
    return {
      id: recordId(rule),
      name: typeof rule.name === 'string' ? rule.name : 'Recurring bill',
      amountMinor: amount(template.amountMinor),
      currency: typeof template.currency === 'string' ? template.currency : input.currency,
      nextOccurrence: Number(rule.nextOccurrence ?? 0),
    };
  });
  const upcomingBillsMinor = upcomingRules.reduce((total, rule) => {
    const template =
      rule.template && typeof rule.template === 'object' ? (rule.template as HomeRecord) : {};
    return total + amount(template.amountMinor);
  }, 0n);

  const contributionByGoal = new Map<string, bigint>();
  for (const contribution of input.goalContributions) {
    if ((contribution.currency ?? input.currency) !== input.currency) continue;
    const goalId = String(contribution.goalId ?? '');
    contributionByGoal.set(
      goalId,
      (contributionByGoal.get(goalId) ?? 0n) + amount(contribution.amountMinor),
    );
  }
  const goals = input.goals
    .filter(
      (goal) =>
        goal.archivedAt === undefined &&
        goal.completedAt === undefined &&
        (goal.currency ?? input.currency) === input.currency,
    )
    .map((goal) => ({
      id: recordId(goal),
      name: typeof goal.name === 'string' ? goal.name : 'Savings goal',
      savedMinor: aliases(goal).reduce(
        (total, key) => total + (contributionByGoal.get(key) ?? 0n),
        0n,
      ),
      targetMinor: amount(goal.targetAmountMinor),
      currency: typeof goal.currency === 'string' ? goal.currency : input.currency,
      targetDate: typeof goal.targetDate === 'number' ? goal.targetDate : undefined,
    }))
    .sort((left, right) => {
      const leftProgress =
        left.targetMinor > 0n ? Number((left.savedMinor * 100n) / left.targetMinor) : 0;
      const rightProgress =
        right.targetMinor > 0n ? Number((right.savedMinor * 100n) / right.targetMinor) : 0;
      return rightProgress - leftProgress;
    })
    .slice(0, 3);

  const membersByGroup = new Map<string, Set<string>>();
  for (const member of input.groupMembers) {
    const group = input.groups.find((item) => hasAlias(item, member.groupId));
    const memberId = String(member.memberId ?? member.userId ?? '');
    if (!group || !memberId) continue;
    const id = recordId(group);
    const members = membersByGroup.get(id) ?? new Set<string>();
    members.add(memberId);
    membersByGroup.set(id, members);
  }
  const groups = input.groups
    .filter((group) => group.archivedAt === undefined)
    .map((group) => {
      const id = recordId(group);
      const groupAliases = new Set(aliases(group));
      const currency = typeof group.currency === 'string' ? group.currency : input.currency;
      const spentMinor = input.transactions.reduce((total, transaction) => {
        if (
          transaction.groupId == null ||
          !groupAliases.has(String(transaction.groupId)) ||
          transaction.type !== 'expense' ||
          !isPosted(transaction) ||
          transaction.currency !== currency
        )
          return total;
        return total + amount(transaction.amountMinor);
      }, 0n);
      return {
        id,
        name: typeof group.name === 'string' ? group.name : 'Shared group',
        currency,
        memberCount: (membersByGroup.get(id) ?? new Set()).size,
        spentMinor,
      };
    })
    .sort((left, right) =>
      right.spentMinor > left.spentMinor
        ? 1
        : right.spentMinor < left.spentMinor
          ? -1
          : left.name.localeCompare(right.name),
    )
    .slice(0, 3);

  const search = input.search?.trim().toLocaleLowerCase() ?? '';
  const categories = [...categoryTotals.entries()]
    .map(([id, category]) => ({ id, ...category }))
    .sort((left, right) =>
      left.amountMinor === right.amountMinor
        ? left.name.localeCompare(right.name)
        : left.amountMinor > right.amountMinor
          ? -1
          : 1,
    )
    .slice(0, 4);
  const recentTransactions = transactions
    .filter((transaction) => transaction.deletedAt === undefined && transaction.status !== 'voided')
    .filter((transaction) => {
      if (!search) return true;
      const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
      const fields = [transaction.title, transaction.merchant, transaction.note, category?.name];
      return fields.some(
        (value) => typeof value === 'string' && value.toLocaleLowerCase().includes(search),
      );
    })
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5)
    .map((transaction) => {
      const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
      return {
        id: recordId(transaction),
        title: typeof transaction.title === 'string' ? transaction.title : 'Transaction',
        category: typeof category?.name === 'string' ? category.name : undefined,
        categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
        currency: typeof transaction.currency === 'string' ? transaction.currency : input.currency,
        amountMinor: amount(transaction.amountMinor),
        type: typeof transaction.type === 'string' ? transaction.type : 'expense',
        status: typeof transaction.status === 'string' ? transaction.status : undefined,
        occurredAt: Number(transaction.occurredAt ?? 0),
        hasTime: transaction.hasTime === true,
        timeZone: input.timeZone,
        groupId: typeof transaction.groupId === 'string' ? transaction.groupId : undefined,
      };
    });

  return {
    balanceMinor,
    spentMinor,
    incomeMinor,
    netMinor: incomeMinor - spentMinor,
    upcomingBillsMinor,
    upcomingBillsCount: upcomingRules.length,
    cashFlow,
    cashFlowRanges: { week: weekCashFlow, month: monthCashFlow, year: cashFlow },
    budgets: budgetRecords,
    upcomingBills,
    goals,
    categories,
    groups,
    transactions: recentTransactions,
  };
}
