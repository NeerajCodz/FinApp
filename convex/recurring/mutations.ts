import { nextOccurrence, type Recurrence } from './domain';

export type RecurringRun = { ruleId: string; occurrence: number; clientMutationId: string };

export function prepareRecurringRun(
  rule: {
    id: string;
    nextOccurrence: number;
    frequency: Recurrence;
    interval: number;
    enabled: boolean;
  },
  now: number,
  processed: readonly RecurringRun[],
): RecurringRun | null {
  if (!rule.enabled || rule.nextOccurrence > now) return null;
  const clientMutationId = `${rule.id}:${rule.nextOccurrence}`;
  if (processed.some((run) => run.clientMutationId === clientMutationId)) return null;
  return { ruleId: rule.id, occurrence: rule.nextOccurrence, clientMutationId };
}

export function advanceRecurringRule(rule: {
  nextOccurrence: number;
  frequency: Recurrence;
  interval: number;
}) {
  return { nextOccurrence: nextOccurrence(rule.nextOccurrence, rule.frequency, rule.interval) };
}
