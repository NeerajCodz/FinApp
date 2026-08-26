import { searchTransactions } from './domain';
import type { ActivityRow } from '../activity/domain';

export function search(rows: readonly ActivityRow[], query: string, limit = 50) {
  return searchTransactions(rows, query).slice(0, Math.min(100, Math.max(0, limit)));
}
