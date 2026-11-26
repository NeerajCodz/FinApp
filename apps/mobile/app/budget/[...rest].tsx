import { Redirect } from 'expo-router';

/** Budgets are category limits now: old budget links (and budget alerts) open Categories. */
export default function BudgetRedirect() {
  return <Redirect href="/categories" />;
}
