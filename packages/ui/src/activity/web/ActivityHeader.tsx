'use client';

import { ChartNoAxesCombined, Search, X } from 'lucide-react';
import { Input, Typography } from '@finapp/ui/web';

export function ActivityHeader({
  query,
  onQueryChange,
  onClearQuery,
  onOpenAnalytics,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <header className="activity-header">
      <div className="activity-heading">
        <Typography variant="title">Activity</Typography>
        <Typography variant="caption">
          Track and manage all your transactions in one place.
        </Typography>
      </div>
      <div className="activity-header-actions">
        <label className="activity-search">
          <Search size={17} aria-hidden="true" />
          <Input
            accessibilityLabel="Search transactions"
            onChangeText={onQueryChange}
            placeholder="Search transactions"
            value={query}
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={onClearQuery}>
              <X size={15} />
            </button>
          )}
        </label>
        <button
          className="activity-analytics-icon"
          type="button"
          aria-label="Open analytics"
          onClick={onOpenAnalytics}
        >
          <ChartNoAxesCombined size={19} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
