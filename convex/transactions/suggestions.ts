export type SuggestionRecord = {
  merchant?: string;
  categoryId?: string;
  accountId: string;
  occurredAt: number;
};

export function suggestFromHistory(
  records: readonly SuggestionRecord[],
  merchant: string,
  localHour: number,
): { categoryId?: string; accountId?: string } {
  const normalized = merchant.trim().toLocaleLowerCase();
  const matching = records
    .filter((record) => record.merchant?.trim().toLocaleLowerCase() === normalized)
    .sort((left, right) => right.occurredAt - left.occurredAt);
  const candidate =
    matching[0] ??
    records
      .filter((record) => Math.abs(new Date(record.occurredAt).getHours() - localHour) <= 1)
      .sort((left, right) => right.occurredAt - left.occurredAt)[0];
  return candidate ? { categoryId: candidate.categoryId, accountId: candidate.accountId } : {};
}
