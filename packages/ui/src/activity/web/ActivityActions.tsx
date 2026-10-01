'use client';

import { ArrowLeftRight, ChartNoAxesCombined, Plus } from 'lucide-react';
import { Button, Card } from '@finapp/ui/web';

export function ActivityActions({
  onAddTransaction,
  onOpenTransactions,
  onOpenAnalytics,
}: {
  onAddTransaction: () => void;
  onOpenTransactions: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <Card className="activity-side-card">
      <Button className="activity-sidebar-add" onPress={onAddTransaction}>
        <Plus size={16} aria-hidden="true" /> Add transaction
      </Button>
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
