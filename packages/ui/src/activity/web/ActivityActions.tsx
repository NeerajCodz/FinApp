'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { Button, Card } from '@finapp/ui/web';

export function ActivityActions({
  onAddTransaction,
  onOpenAnalytics,
}: {
  onAddTransaction: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <Card className="activity-side-card">
      <Button className="activity-sidebar-add" onPress={onAddTransaction}>
        <Plus size={16} aria-hidden="true" /> Add transaction
      </Button>
      <button type="button" className="activity-analytics-link" onClick={onOpenAnalytics}>
        Explore analytics <ArrowRight size={14} aria-hidden="true" />
      </button>
    </Card>
  );
}
