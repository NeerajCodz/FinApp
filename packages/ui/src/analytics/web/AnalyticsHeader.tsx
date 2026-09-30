'use client';
import { Download } from 'lucide-react';
import { Button, Typography } from '@finapp/ui/web';
import { InfoDescription } from '@finapp/ui/finance';

type AnalyticsHeaderProps = {
  onExport: () => void;
};

export function AnalyticsHeader({ onExport }: AnalyticsHeaderProps) {
  return (
    <header className="analytics-page-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography variant="title">Analytics</Typography>
          <InfoDescription
            title="Analytics"
            description="Understand your spending, income and overall financial health. Track trends, discover insights and make better decisions."
          />
        </div>
      </div>
      <Button variant="outline" onPress={onExport}>
        <Download size={16} aria-hidden="true" /> Export
      </Button>
    </header>
  );
}
