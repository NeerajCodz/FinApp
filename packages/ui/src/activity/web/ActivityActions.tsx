'use client';

import { ArrowLeftRight, ChartNoAxesCombined } from 'lucide-react';
import { Card } from '@finapp/ui/web';

/** Shortcuts beside the activity list (adding a transaction is the app-wide + button). */
export function ActivityActions({
  onOpenTransactions,
  onOpenAnalytics,
}: {
  onOpenTransactions: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <Card className="activity-side-card">
      <div className="activity-sidebar-links">
        <button type="button" className="activity-sidebar-link" onClick={onOpenAnalytics}>
          <ChartNoAxesCombined size={18} aria-hidden="true" />
          <span>Analytics</span>
        </button>
        <button type="button" className="activity-sidebar-link" onClick={onOpenTransactions}>
          <ArrowLeftRight size={18} aria-hidden="true" />
          <span>Transactions</span>
        </button>
      </div>
    </Card>
  );
}
