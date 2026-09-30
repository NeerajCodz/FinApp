'use client';
import { Download } from 'lucide-react';
import { Button, Typography } from '@finapp/ui/web';

type AnalyticsHeaderProps = {
  onExport: () => void;
};

export function AnalyticsHeader({ onExport }: AnalyticsHeaderProps) {
  return (
    <header className="analytics-page-header">
      <div>
        <p className="analytics-page-kicker">A clearer view of your money</p>
        <Typography variant="title">Analytics</Typography>
        <p className="analytics-page-description">
          Understand your spending, income and overall financial health. Track trends, discover
          insights and make better decisions.
        </p>
      </div>
      <Button variant="outline" onPress={onExport}>
        <Download size={16} aria-hidden="true" /> Export
      </Button>
    </header>
  );
}
