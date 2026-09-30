'use client';

import { Card, Typography } from '@finapp/ui/web';

export type ActivityCategoryItem = {
  id: string;
  name: string;
  icon: string;
  amount: string;
  share: number;
};

export function ActivityTopCategories({
  items,
  rangeLabel,
  onSelect,
}: {
  items: readonly ActivityCategoryItem[];
  rangeLabel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="activity-side-card">
      <div className="activity-section-heading">
        <div>
          <Typography variant="bodyLarge">Top categories</Typography>
          <Typography variant="caption">Posted expenses · {rangeLabel}</Typography>
        </div>
      </div>
      {items.length ? (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="activity-category-link"
            onClick={() => onSelect(item.id)}
          >
            <span className="activity-category-line">
              <span className="activity-category-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="activity-category-name">{item.name}</span>
              <span className="activity-category-amount">{item.amount}</span>
            </span>
            <span className="activity-category-track">
              <span style={{ width: `${item.share}%` }} data-leading={index === 0 || undefined} />
            </span>
          </button>
        ))
      ) : (
        <Typography variant="caption">No posted expenses in this range.</Typography>
      )}
    </Card>
  );
}
