'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { Button, Card, Typography } from '@finapp/ui/web';

export type ActivityQuickFilter = 'Today' | 'This week' | 'This month' | 'Last month' | 'All time';

export function ActivityQuickFilters({
  options,
  onSelectRange,
  onAddTransaction,
  onOpenAnalytics,
}: {
  options: readonly ActivityQuickFilter[];
  onSelectRange: (label: ActivityQuickFilter) => void;
  onAddTransaction: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <Card className="activity-side-card">
      <Button className="activity-sidebar-add" onPress={onAddTransaction}><Plus size={16} aria-hidden="true" /> Add transaction</Button>
      <div className="activity-section-heading"><div><Typography variant="bodyLarge">Quick filters</Typography><Typography variant="caption">Jump to a familiar date range</Typography></div></div>
      <div className="activity-quick-filters">
        {options.map((label) => <button key={label} type="button" className="activity-quick-filter" onClick={() => onSelectRange(label)}>{label}</button>)}
      </div>
      <button type="button" className="activity-analytics-link" onClick={onOpenAnalytics}>Explore analytics <ArrowRight size={14} aria-hidden="true" /></button>
    </Card>
  );
}
