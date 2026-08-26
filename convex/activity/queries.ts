import { filterActivity, paginateActivity, type ActivityFilter, type ActivityRow } from './domain';

export function activityFeed(
  rows: readonly ActivityRow[],
  filter: ActivityFilter,
  cursor = 0,
  limit = 25,
) {
  return paginateActivity(filterActivity(rows, filter), cursor, Math.min(limit, 100));
}
